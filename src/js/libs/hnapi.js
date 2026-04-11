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

// --- Algolia search → app format ---

function transformSearchHit(hit) {
	if (!hit) return null
	const tags = hit._tags || []
	let type = 'link'
	if (tags.includes('job')) type = 'job'
	else if (tags.includes('poll')) type = 'poll'
	else if (tags.includes('ask_hn') || !hit.url) type = 'ask'
	return {
		id: parseInt(hit.objectID, 10),
		title: hit.title || '',
		url: hit.url || 'item?id=' + hit.objectID,
		points: hit.points || 0,
		comments_count: hit.num_comments || 0,
		time_ago: timeAgo(hit.created_at_i),
		type: type,
		user: hit.author || '',
	}
}

// --- Algolia item → app format ---

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

// --- Public API ---

const hnapi = {
	news: function (success, error) {
		req(
			ALGOLIA_URL + 'search?tags=front_page&hitsPerPage=100',
			function (data) {
				const stories = (data.hits || []).map(transformSearchHit).filter(Boolean)
				if (stories.length > 0) success(stories)
				else error(new Error('No stories returned'))
			},
			error,
		)
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
}

export default hnapi
