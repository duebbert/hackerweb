const FIREBASE_URL = 'https://hacker-news.firebaseio.com/v0/'
const ALGOLIA_URL = 'https://hn.algolia.com/api/v1/'
const timeout = 20000

// --- Helpers ---

function timeAgo(unixSeconds) {
	const seconds = Math.floor(Date.now() / 1000 - unixSeconds)
	if (seconds < 0) return 'just now'
	const intervals = [
		[31536000, 'year'],
		[2592000, 'month'],
		[86400, 'day'],
		[3600, 'hour'],
		[60, 'minute'],
	]
	for (const [secs, label] of intervals) {
		const count = Math.floor(seconds / secs)
		if (count >= 1) return count + ' ' + label + (count !== 1 ? 's' : '') + ' ago'
	}
	return seconds + ' second' + (seconds !== 1 ? 's' : '') + ' ago'
}

function req(url, success, error) {
	const controller = new AbortController()
	const timer = setTimeout(function () {
		controller.abort()
	}, timeout)

	fetch(url, { signal: controller.signal })
		.then(function (response) {
			clearTimeout(timer)
			if (!response.ok) throw new Error('HTTP ' + response.status)
			return response.json()
		})
		.then(function (data) {
			if (data == null) throw new Error('Empty response')
			success(data)
		})
		.catch(function (e) {
			clearTimeout(timer)
			error(e)
		})
}

// --- Firebase → app format ---

function transformStory(item) {
	if (!item || item.dead || item.deleted) return null
	const hnType = item.type
	let type = 'link'
	if (hnType === 'job') type = 'job'
	else if (hnType === 'poll') type = 'poll'
	else if (hnType === 'ask' || (!item.url && hnType === 'story')) type = 'ask'
	return {
		id: item.id,
		title: item.title || '',
		url: item.url || 'item?id=' + item.id,
		points: item.score || 0,
		comments_count: item.descendants || 0,
		time_ago: timeAgo(item.time),
		type: type,
		user: item.by || '',
	}
}

// --- Algolia → app format ---

function transformComment(child) {
	if (!child) return null
	const deleted = !child.author
	return {
		id: child.id,
		user: child.author || null,
		time_ago: timeAgo(Math.floor(new Date(child.created_at).getTime() / 1000)),
		content: child.text || '',
		deleted: deleted,
		comments: (child.children || []).map(transformComment).filter(Boolean),
	}
}

function transformItem(item) {
	return {
		id: item.id,
		title: item.title || '',
		url: item.url || 'item?id=' + item.id,
		points: item.points || 0,
		comments_count: countComments(item.children),
		time_ago: timeAgo(Math.floor(new Date(item.created_at).getTime() / 1000)),
		type: item.type === 'story' ? 'link' : item.type || 'link',
		user: item.author || '',
		content: item.text || null,
		comments: (item.children || []).map(transformComment).filter(Boolean),
	}
}

function countComments(children) {
	if (!children) return 0
	let count = 0
	for (const child of children) {
		count += 1 + countComments(child.children)
	}
	return count
}

// --- Batch fetch stories from Firebase ---

function fetchStories(ids, success, error) {
	const results = []
	let totalPending = ids.length
	if (totalPending === 0) {
		success([])
		return
	}
	const batchSize = 5
	let i = 0

	function finalize() {
		// Sort by original ID order
		const order = {}
		for (let j = 0; j < ids.length; j++) order[ids[j]] = j
		results.sort(function (a, b) {
			return order[a.id] - order[b.id]
		})
		if (results.length > 0) success(results)
		else error(new Error('Failed to fetch stories'))
	}

	function fetchBatch() {
		const batch = ids.slice(i, i + batchSize)
		if (batch.length === 0) return
		i += batchSize
		let batchDone = 0
		for (const id of batch) {
			req(
				FIREBASE_URL + 'item/' + id + '.json',
				function (item) {
					const story = transformStory(item)
					if (story) results.push(story)
					if (--totalPending === 0) {
						finalize()
					} else if (++batchDone === batch.length) {
						fetchBatch()
					}
				},
				function () {
					if (--totalPending === 0) {
						finalize()
					} else if (++batchDone === batch.length) {
						fetchBatch()
					}
				},
			)
		}
	}
	fetchBatch()
}

// --- Module state ---

let cachedTopStoryIds = null

// --- Public API ---

const hnapi = {
	news: function (success, error) {
		req(
			FIREBASE_URL + 'topstories.json',
			function (ids) {
				cachedTopStoryIds = ids
				fetchStories(ids.slice(0, 30), success, error)
			},
			error,
		)
	},

	news2: function (success, error) {
		if (cachedTopStoryIds && cachedTopStoryIds.length > 30) {
			fetchStories(cachedTopStoryIds.slice(30, 60), success, error)
		} else {
			req(
				FIREBASE_URL + 'topstories.json',
				function (ids) {
					cachedTopStoryIds = ids
					if (ids.length > 30) {
						fetchStories(ids.slice(30, 60), success, error)
					} else {
						success([])
					}
				},
				error,
			)
		}
	},

	item: function (id, success, error) {
		req(
			ALGOLIA_URL + 'items/' + id,
			function (data) {
				success(transformItem(data))
			},
			error,
		)
	},

	comments: function (id, success, error) {
		hnapi.item(id, success, error)
	},
}

export default hnapi
