import hnapi from './libs/hnapi.js'
import router from './libs/router.js'
import store from './libs/store.js'
import TEMPLATES from './templates.jsx'

const d = document

const $ = function (id) {
	return d.getElementById(id)
}

const pubsubCache = {},
	clone = function (obj) {
		return Object.assign({}, obj)
	}

const hw = {
	// PubSub
	pub: function (topic, data) {
		const t = pubsubCache[topic]
		if (!t) return
		for (const fn of t) {
			fn.call(this, data)
		}
	},
	sub: function (topic, fn) {
		if (!pubsubCache[topic]) pubsubCache[topic] = []
		pubsubCache[topic].push(fn)
	},
	currentView: null,
	hideAllViews: function () {
		for (const view of d.querySelectorAll('.view')) {
			view.classList.add('hidden')
		}
	},
	tmpl: function (template, data) {
		const t = TEMPLATES[template]
		if (!t) return
		if (!data) return t
		return t(data)
	},
	setTitle: function (str) {
		let title = 'HackerWeb'
		if (str) {
			str = str.trim()
			if (str.toLowerCase() !== title.toLowerCase()) {
				title = str + ' \u2013 ' + title
			}
		}
		d.title = title
	},
}

const tmpl = hw.tmpl

// Fix browsers freak out of store.sessionStorage not a function
if (!store.sessionStorage || typeof store.sessionStorage !== 'function') {
	store.sessionStorage = store.memory // Fallback to in-memory storage
}

const linkElement = d.createElement('a')
const domainsCache = {}
const domainify = function (url) {
	let domained = domainsCache[url]
	if (domained) return domained
	linkElement.href = url
	const domain = linkElement.hostname.replace(/^www\./, '')
	const pathname = linkElement.pathname.replace(/^\//, '').split('/')[0]
	const pathnameLen = pathname.length
	const firstPath =
		domain.length <= 25 &&
		pathnameLen > 3 &&
		pathnameLen <= 15 &&
		/^[^0-9][^.]+$/.test(pathname)
			? '/' + pathname
			: ''
	domained = domain + firstPath
	domainsCache[url] = domained
	return domained
}

// Remove cached comments for stories no longer on the front page.
// Only runs when online to preserve offline reading data.
const cleanupStaleItems = function () {
	if (!navigator.onLine) return
	const news = store('hacker-news') || []
	const activeIds = {}
	for (const item of news) activeIds[item.id] = true
	const allStored = store() || {}
	for (const key in allStored) {
		if (/^hacker-item-\d+$/.test(key)) {
			const id = Number(key.replace('hacker-item-', ''))
			if (!activeIds[id]) store(key, null)
		}
	}
}

// Search the news cache for a post by ID.
// Returns { post, news } or null.
const findCachedPost = function (id) {
	const news = store('hacker-news')
	if (news) {
		for (const post of news) {
			if (id === post.id) return { post: post, news: news }
		}
	}
	return null
}

const filterNews = function (data) {
	if (localStorage['hackerweb:options:hide-no-comments'] !== 'off') {
		return data.filter(function (item) {
			return item.comments_count > 0
		})
	}
	return data
}
const $homeScroll = d.querySelector('#view-home .scroll'),
	$homeScrollSection = $homeScroll.querySelector('section')
let loadingNews = false

hw.news = {
	markupStory: function (item) {
		if (/^item/i.test(item.url)) {
			item.url = '#/item/' + item.id
		} else {
			item.external = true
			item.domain = domainify(item.url)
		}
		item.i_point = item.points === 1 ? 'point' : 'points'
		item.i_comment = item.comments_count === 1 ? 'comment' : 'comments'
		const isCached = !!store('hacker-item-' + item.id)
		const cachingEnabled = localStorage['hackerweb:options:offline-cache'] !== 'off'
		item.cached = isCached ? 'cached' : cachingEnabled ? 'pending' : false
		return tmpl('post', item)
	},
	markupStories: function (data, i) {
		let html = ''
		if (!i) i = 1
		const markupStory = hw.news.markupStory
		for (const item of data) {
			item.i = i++
			html += markupStory(item)
		}
		return html
	},
	// Re-markup the story item in the News list when
	// there's an update from specific API call of the item.
	// Make sure the title, points, comments count, etc matches.
	updateStory: function (story) {
		if (!story?.id) return
		const id = story.id
		const data = story.data
		const cached = findCachedPost(id)
		if (!cached) return
		const post = cached.post
		// Pass in the possibly changed values
		let changed = false
		for (const key of ['title', 'url', 'time_ago', 'comments_count', 'points']) {
			const val = data[key]
			if (post[key] !== val) {
				post[key] = val
				changed = true
			}
		}
		if (!changed) return
		// Update the news cache (post was mutated in-place within cached.news)
		store('hacker-news', cached.news)
		// Update the story in the news list
		const storyEl = $('story-' + id)
		if (!storyEl) return
		post.selected = !!storyEl.querySelector('a[href].selected')
		post.i = storyEl.dataset
			? storyEl.dataset.index
			: storyEl.getAttribute('data-index')
		storyEl.insertAdjacentHTML('afterend', hw.news.markupStory(post))
		storyEl.parentNode.removeChild(storyEl)
	},
	render: function (opts) {
		if (loadingNews) return
		if (!opts) opts = {}
		const cached = store('hacker-news-cached')
		const tmpl1 = tmpl('stories-load')
		const loadNews = function (data) {
			const filtered = filterNews(data)
			const html =
				'<ul class="tableview tableview-links" id="hwlist">' +
				hw.news.markupStories(filtered) +
				'</ul>'
			$homeScrollSection.innerHTML = html
			hw.pub('onRenderNews')
		}
		if (cached) {
			const news = store('hacker-news')
			const delay = opts.delay
			if (delay) {
				loadingNews = true
				$homeScrollSection.innerHTML = tmpl1({ loading: true })
				setTimeout(function () {
					loadingNews = false
					loadNews(news)
				}, delay)
			} else {
				loadNews(news)
			}
		} else {
			loadingNews = true
			$homeScrollSection.innerHTML = tmpl1({ loading: true })
			const showError = function () {
				$homeScrollSection.innerHTML = tmpl1({ load_error: true })
			}
			hnapi.news(
				function (data) {
					loadingNews = false
					if (!data || data.error) {
						showError()
						return
					}
					store('hacker-news', data)
					store('hacker-news-cached', true, {
						expires: 1000 * 60 * 10, // 10 minutes
					})
					loadNews(data)
					cleanupStaleItems()
				},
				function (_e) {
					loadingNews = false
					const staleNews = store('hacker-news')
					if (staleNews) {
						loadNews(staleNews)
					} else {
						showError()
					}
				},
			)
		}
	},
	reload: function () {
		store('hacker-news', null)
		store('hacker-news-cached', null)
		hw.preloader.stop()
		hw.news.render({
			delay: 300, // Cheat a little to make user think that it's doing something
		})
	},
}

const $commentsView = $('view-comments'),
	$commentsHeading = $commentsView.querySelector('header h1'),
	$commentsSection = $commentsView.querySelector('section')

hw.comments = {
	currentID: null,
	render: function (id) {
		if (!id) return
		let post = store('hacker-item-' + id)
		if (hw.comments.currentID === id && post) return
		hw.comments.currentID = id

		const loadPost = function (_data, id) {
			const data = clone(_data),
				tmpl1 = tmpl('post-comments')

			data.has_post = !!data.title
			if (!data.has_post) {
				hw.setTitle()
				$commentsHeading.innerText = ''
				$commentsSection.innerHTML = tmpl1(data)
				hw.pub('onRenderComments')
				return
			}

			// If "local" link, link to Hacker News web site
			if (/^item/i.test(data.url)) {
				data.url = '//news.ycombinator.com/' + data.url
			} else {
				data.domain = domainify(data.url)
			}
			data.has_comments = data.comments && !!data.comments.length
			data.i_point = data.points === 1 ? 'point' : 'points'
			data.i_comment = data.comments_count === 1 ? 'comment' : 'comments'
			data.has_content = !!data.content
			if (data.poll) {
				let total = 0
				let max = 0
				for (const p of data.poll) {
					const points = p.points
					if (points > max) max = points
					total += points
					p.i_point = points === 1 ? 'point' : 'points'
				}
				for (const p of data.poll) {
					const points = p.points
					p.percentage = ((points / total) * 100).toFixed(1)
					p.width = ((points / max) * 100).toFixed(1) + '%'
				}
				data.has_poll = data.has_content = true
			}
			data.short_hn_url = 'news.ycombinator.com/item?id=' + id
			data.hn_url = '//' + data.short_hn_url
			hw.setTitle(data.title)
			$commentsHeading.innerText = data.title

			const html = tmpl1(data)
			const div = d.createElement('div')
			div.innerHTML = html

			// Make all links open in new tab/window
			// If it's a comment permalink, link to HN
			for (const link of div.querySelectorAll('a')) {
				link.target = '_blank'
			}

			// Highlight the OP
			const opUser = data.user
			if (opUser) {
				for (const user of div.querySelectorAll('.user')) {
					if (user.textContent.trim() === opUser) {
						user.classList.add('op')
						user.title = 'Original Poster'
					}
				}
			}

			// Add a collapse/expand toggle to every nested reply list.
			for (const subUl of div.querySelectorAll('.comments li > ul')) {
				const commentsCount = subUl.querySelectorAll('.metadata').length
				if (commentsCount < 3) continue
				subUl.style.display = 'none'
				subUl.insertAdjacentHTML(
					'beforebegin',
					'<button class="comments-toggle collapsed">' +
						commentsCount +
						' replies</button>',
				)
			}

			$commentsSection.replaceChildren(...div.childNodes)

			hw.pub('onRenderComments')
		}

		// Re-fetch if the story list shows a different comment count than the cache
		const newsEntry = post && findCachedPost(id)
		const stale = newsEntry && newsEntry.post.comments_count !== post.comments_count

		if (post && !stale) {
			window.scrollTo(0, 0)
			loadPost(post, id)
		} else {
			const cached = newsEntry || findCachedPost(id)
			if (cached) post = cached.post
			if (post) {
				post.loading = true
				loadPost(post, id)
			} else {
				loadPost({ loading: true }, id)
			}
			const showError = function () {
				if (post) {
					delete post.loading
					post.load_error = true
					loadPost(post, id)
				} else {
					loadPost({ load_error: true }, id)
				}
			}
			hnapi.item(
				id,
				function (data) {
					if (hw.comments.currentID !== id) return
					if (!data || (data.error && hw.currentView === 'comments')) {
						showError()
						return
					}
					store('hacker-item-' + id, data, {
						expires: 1000 * 60 * 60 * 24, // 24 hours
					})
					hw.news.updateStory({
						id: id,
						data: data,
					})
					loadPost(data, id)
				},
				function (_e) {
					if (hw.comments.currentID !== id) return
					showError()
				},
			)
		}
	},
	toggle: function (target) {
		const ul = target.nextElementSibling
		if (ul) {
			const ulStyle = ul.style
			const top = window.pageYOffset || document.documentElement.scrollTop || 0
			const collapsed = ulStyle.display !== 'none'
			ulStyle.display = collapsed ? 'none' : ''
			if (collapsed) {
				target.classList.add('collapsed')
			} else {
				target.classList.remove('collapsed')
			}
			window.scrollTo(0, top)
		}
	},
	collapseParent: function (target) {
		const li = target.closest('li')
		if (!li) return
		const parentUl = li.parentNode
		if (!parentUl || parentUl.tagName !== 'UL') return
		const grandparentLi = parentUl.parentNode
		if (!grandparentLi || grandparentLi.tagName !== 'LI') return
		parentUl.style.display = 'none'
		const toggleBtn = parentUl.previousElementSibling
		if (toggleBtn?.classList?.contains('comments-toggle')) {
			toggleBtn.classList.add('collapsed')
		} else {
			const commentsCount = parentUl.querySelectorAll('.metadata').length
			const replyWord = commentsCount === 1 ? 'reply' : 'replies'
			parentUl.insertAdjacentHTML(
				'beforebegin',
				'<button class="comments-toggle collapsed">' +
					commentsCount +
					' ' +
					replyWord +
					'</button>',
			)
		}
		if (grandparentLi.scrollIntoView) {
			grandparentLi.scrollIntoView({ block: 'start' })
		}
	},
	reload: function () {
		hw.comments.currentID = null
		router.reload()
	},
}

hw.preloader = {
	queue: [],
	retries: {},
	running: false,
	concurrency: 5,
	maxRetries: 2,
	markCached: function (id) {
		const storyEl = $('story-' + id)
		if (!storyEl) return
		const existing = storyEl.querySelector('.cached-indicator')
		if (existing) {
			existing.classList.remove('pending')
			existing.title = 'Available offline'
		} else {
			const meta = storyEl.querySelector('.metadata .inline-block:last-child')
			if (meta) {
				meta.insertAdjacentHTML(
					'beforeend',
					'<span class="cached-indicator" title="Available offline"></span>',
				)
			}
		}
	},
	start: function (news) {
		const newIds = news
			.filter(function (item) {
				return !store('hacker-item-' + item.id)
			})
			.map(function (item) {
				return item.id
			})
		if (newIds.length === 0) return
		if (hw.preloader.running) {
			// Append to existing queue, skip duplicates
			const queued = {}
			for (const id of hw.preloader.queue) queued[id] = true
			for (const id of newIds) {
				if (!queued[id]) hw.preloader.queue.push(id)
			}
			return
		}
		hw.preloader.queue = newIds
		hw.preloader.retries = {}
		hw.preloader.running = true
		hw.preloader.fetchBatch()
	},
	fetchBatch: function () {
		if (!hw.preloader.queue.length) {
			hw.preloader.running = false
			return
		}
		const batch = hw.preloader.queue.splice(0, hw.preloader.concurrency)
		let pending = batch.length
		for (const id of batch) {
			if (store('hacker-item-' + id)) {
				hw.preloader.markCached(id)
				if (--pending === 0) hw.preloader.fetchBatch()
				continue
			}
			hnapi.item(
				id,
				function (data) {
					if (data && !data.error) {
						try {
							store('hacker-item-' + id, data, {
								expires: 1000 * 60 * 60 * 24,
							})
							hw.preloader.markCached(id)
						} catch (_e) {
							// Quota exceeded — stop preloading
							hw.preloader.queue = []
						}
					}
					if (--pending === 0) hw.preloader.fetchBatch()
				},
				function () {
					// Retry failed items
					const retryCount = hw.preloader.retries[id] || 0
					if (retryCount < hw.preloader.maxRetries) {
						hw.preloader.retries[id] = retryCount + 1
						hw.preloader.queue.push(id)
					}
					if (--pending === 0) hw.preloader.fetchBatch()
				},
			)
		}
	},
	stop: function () {
		hw.preloader.queue = []
		hw.preloader.running = false
	},
}

hw.sub('onRenderNews', function () {
	if (localStorage['hackerweb:options:offline-cache'] === 'off') return
	const news = store('hacker-news')
	if (news) hw.preloader.start(news)
})

hw.init = function () {
	hw.news.render()
	router.init()

	let colorSchemeRetries = 0
	function renderColorScheme() {
		let cssRule = null
		for (const sheet of document.styleSheets) {
			if (cssRule) break
			try {
				for (const rule of sheet.cssRules) {
					if (rule.media && /color-scheme:\s*dark/i.test(rule.media.mediaText)) {
						cssRule = rule
						break
					}
				}
			} catch (_e) {
				// Skip cross-origin stylesheets
			}
		}
		if (!cssRule) {
			if (++colorSchemeRetries < 10) setTimeout(renderColorScheme, 1000)
			return
		}
		if (cssRule) {
			$('hw-appearance-container').hidden = false
			const $hwAppearance = $('hw-appearance')
			const $metaColorScheme = $('meta-color-scheme')
			const prefersColorSchemeSupported =
				window.matchMedia &&
				window.matchMedia('(prefers-color-scheme)').media !== 'not all'
			const appearanceStorageKey = 'hw-appearance'
			let appearance = localStorage.getItem(appearanceStorageKey) || 'auto'

			function setAppearance(appearance) {
				if (appearance === 'dark') {
					cssRule.media.mediaText = 'screen'
					$metaColorScheme.content = 'dark'
				} else if (appearance === 'light') {
					cssRule.media.mediaText = 'not all'
					$metaColorScheme.content = 'light'
				} else {
					cssRule.media.mediaText = '(prefers-color-scheme: dark)'
					$metaColorScheme.content = 'dark light'
				}
			}
			setAppearance(appearance)

			let input
			if (prefersColorSchemeSupported) {
				$hwAppearance.querySelector(
					'[name=hw-appearance][value=auto]',
				).parentNode.hidden = false
				input = $hwAppearance.querySelector(
					'[name=hw-appearance][value=' + appearance + ']',
				)
				input.checked = true
			} else {
				if (!/(light|dark)/i.test(appearance)) {
					appearance = 'light'
				}
				input = $hwAppearance.querySelector(
					'[name=hw-appearance][value="' + appearance + '"]',
				)
				input.checked = true
			}
			$hwAppearance.onclick = function () {
				const checkedInput = $hwAppearance.querySelector('[name=hw-appearance]:checked')
				const appearance = checkedInput.value
				localStorage.setItem(appearanceStorageKey, appearance)
				setAppearance(appearance)
			}
		}
	}
	renderColorScheme()

	// "Hide stories with no comments" toggle on the About page.
	const $hideNoComments = $('hw-hide-no-comments')
	if ($hideNoComments) {
		const hideKey = 'hackerweb:options:hide-no-comments'
		const current = localStorage[hideKey] === 'off' ? 'off' : 'on'
		const input = $hideNoComments.querySelector(
			'[name=hw-hide-no-comments][value="' + current + '"]',
		)
		if (input) input.checked = true
		$hideNoComments.onclick = function () {
			const checked = $hideNoComments.querySelector(
				'[name=hw-hide-no-comments]:checked',
			)
			if (!checked) return
			if (checked.value === 'off') {
				localStorage[hideKey] = 'off'
			} else {
				delete localStorage[hideKey]
			}
			hw.news.render()
		}
	}

	// "Cache comments for offline" toggle on the About page.
	const $offlineCache = $('hw-offline-cache')
	if ($offlineCache) {
		const cacheKey = 'hackerweb:options:offline-cache'
		const current = localStorage[cacheKey] === 'off' ? 'off' : 'on'
		const cacheInput = $offlineCache.querySelector(
			'[name=hw-offline-cache][value="' + current + '"]',
		)
		if (cacheInput) cacheInput.checked = true
		$offlineCache.onclick = function () {
			const checked = $offlineCache.querySelector('[name=hw-offline-cache]:checked')
			if (!checked) return
			localStorage[cacheKey] = checked.value
			if (checked.value === 'on') {
				const news = store('hacker-news')
				if (news) hw.preloader.start(news)
			} else {
				hw.preloader.stop()
			}
		}
	}
}

router
	.config({
		notfound: function () {
			router.go('/')
		},
	})
	.add('/', 'home')
	.add('/about', 'about')
	.add(/^\/item\/(\d+)$/i, 'comments', function (_path, id) {
		hw.comments.render(id)
	})

export { $, hw, router, store }
