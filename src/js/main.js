import { $, hw, router, store } from './hw.js'

const d = document

// Adjust min-height on the views based on the viewport
const head = d.head || d.getElementsByTagName('head')[0]
const adjustViewsHeight = function () {
	let vh = window.innerHeight
	let style = $('view-height')
	if (!style) {
		style = d.createElement('style')
		style.id = 'view-height'
		head.appendChild(style)
	}
	if (window.innerWidth >= 788) vh *= 0.9
	style.textContent = '.view>.scroll{min-height: ' + vh + 'px}'
}
window.addEventListener('resize', adjustViewsHeight, false)
window.addEventListener('orientationchange', adjustViewsHeight, false)
adjustViewsHeight()

// Remember scroll tops using pageYOffset (web theme style)
const scrollTops = {}
let scrollTimeout
const getScrollTop = function () {
	return (
		window.pageYOffset ||
		(d.compatMode === 'CSS1Compat' && d.documentElement.scrollTop) ||
		0
	)
}
const saveScrollTop = function () {
	const hash = location.hash.slice(1)
	const top = getScrollTop()
	scrollTops[hash] = top
	const key = 'hacker-scrolltop-' + hash
	store.sessionStorage(key, top)
}
window.addEventListener(
	'scroll',
	function () {
		clearTimeout(scrollTimeout)
		scrollTimeout = setTimeout(saveScrollTop, 500)
	},
	false,
)

router.config({
	before: function (_path, name, _matches) {
		hw.previousView = hw.currentView
		hw.currentView = name
		const currentView = name
		const view = $('view-' + currentView)
		hw.setTitle(view.querySelector('header h1').textContent)

		// Simple show/hide: hide all views, show the current one
		hw.hideAllViews()
		view.classList.remove('hidden')

		if (currentView === 'comments') {
			// nothing extra
		} else if (currentView === 'about') {
			// Also show home behind about
			$('view-home').classList.remove('hidden')
		}
	},
	on: function () {
		const hash = location.hash.slice(1)
		const key = 'hacker-scrolltop-' + hash
		let top = store.sessionStorage(key)
		window.scrollTo(0, scrollTops[hash] || top || 0)
		top = getScrollTop()
		scrollTops[hash] = top
		store.sessionStorage(key, top)
	},
})

// Event delegation helper
const on = function (selector, event, fn) {
	d.body.addEventListener(
		event,
		function (e) {
			const target = e.target.closest(selector)
			if (target) fn(e, target)
		},
		false,
	)
}

// Header button navigation
on('.view>header a.header-button[href]', 'click', function (e, target) {
	e.preventDefault()
	location.hash = target.hash
})

// Refresh button
on('#view-home-refresh', 'click', function (e) {
	e.preventDefault()
	hw.news.reload()
})

// Story list clicks
on('#view-home .tableview-links li>a:first-child', 'click', function (e, target) {
	if (target.classList.contains('more-link')) {
		e.preventDefault()
		hw.news.more(target)
	}
})

// Comment toggle
on('button.comments-toggle', 'click', function (_e, target) {
	hw.comments.toggle(target)
})

// Collapse parent comment
on('button.collapse-parent', 'click', function (_e, target) {
	hw.comments.collapseParent(target)
})

// Retry loading comments
on('#view-comments .load-error button', 'click', function () {
	hw.comments.reload()
})

// Auto-reload when returning to page if cache expired
window.addEventListener(
	'pageshow',
	function () {
		setTimeout(function () {
			if (hw.currentView === 'home' && $('hwlist') && !store('hacker-news-cached')) {
				hw.news.reload()
			}
		}, 1)
	},
	false,
)

hw.news.options.disclosure = true
hw.init()
