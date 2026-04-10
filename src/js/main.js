import { hw, $, store, router } from './hw.js';

(function (w) {
	var d = w.document;

	// Adjust min-height on the views based on the viewport
	var head = d.head || d.getElementsByTagName('head')[0];
	var adjustViewsHeight = function () {
		var vh = w.innerHeight;
		var style = $('view-height');
		if (!style) {
			style = d.createElement('style');
			style.id = 'view-height';
			head.appendChild(style);
		}
		if (w.innerWidth >= 788) vh *= 0.9;
		style.textContent = '.view>.scroll{min-height: ' + vh + 'px}';
	};
	w.addEventListener('resize', adjustViewsHeight, false);
	w.addEventListener('orientationchange', adjustViewsHeight, false);
	adjustViewsHeight();

	// Remember scroll tops using pageYOffset (web theme style)
	var scrollTops = {};
	var scrollTimeout;
	var getScrollTop = function () {
		return w.pageYOffset || (d.compatMode === 'CSS1Compat' && d.documentElement.scrollTop) || 0;
	};
	var saveScrollTop = function () {
		var hash = location.hash.slice(1);
		var top = (scrollTops[hash] = getScrollTop());
		var key = 'hacker-scrolltop-' + hash;
		store.sessionStorage(key, top);
	};
	w.addEventListener(
		'scroll',
		function () {
			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(saveScrollTop, 500);
		},
		false,
	);

	router.config({
		before: function (path, name, matches) {
			var previousView = (hw.previousView = hw.currentView);
			var currentView = (hw.currentView = name);
			var view = $('view-' + currentView);
			hw.setTitle(view.querySelector('header h1').textContent);

			// Simple show/hide: hide all views, show the current one
			hw.hideAllViews();
			view.classList.remove('hidden');

			if (currentView == 'comments') {
				// nothing extra
			} else if (currentView == 'about') {
				// Also show home behind about
				$('view-home').classList.remove('hidden');
			}
		},
		on: function () {
			var hash = location.hash.slice(1);
			var key = 'hacker-scrolltop-' + hash;
			var top = store.sessionStorage(key);
			w.scrollTo(0, scrollTops[hash] || top || 0);
			top = scrollTops[hash] = getScrollTop();
			store.sessionStorage(key, top);
		},
	});

	// Event delegation helper
	var on = function (selector, event, fn) {
		d.body.addEventListener(
			event,
			function (e) {
				var target = e.target.closest(selector);
				if (target) fn(e, target);
			},
			false,
		);
	};

	// Header button navigation
	on('.view>header a.header-button[href]', 'click', function (e, target) {
		e.preventDefault();
		location.hash = target.hash;
	});

	// Refresh button
	on('#view-home-refresh', 'click', function (e) {
		e.preventDefault();
		hw.news.reload();
	});

	// Story list clicks
	on('#view-home .tableview-links li>a:first-child', 'click', function (e, target) {
		if (target.classList.contains('more-link')) {
			e.preventDefault();
			hw.news.more(target);
		}
	});

	// Comment toggle
	on('button.comments-toggle', 'click', function (e, target) {
		hw.comments.toggle(target);
	});

	// Collapse parent comment
	on('button.collapse-parent', 'click', function (e, target) {
		hw.comments.collapseParent(target);
	});

	// Retry loading comments
	on('#view-comments .load-error button', 'click', function () {
		hw.comments.reload();
	});

	// Auto-reload when returning to page if cache expired
	w.addEventListener(
		'pageshow',
		function () {
			setTimeout(function () {
				if (hw.currentView == 'home' && $('hwlist') && !store('hacker-news-cached')) {
					hw.news.reload();
				}
			}, 1);
		},
		false,
	);

	hw.news.options.disclosure = true;
	hw.init();
})(window);
