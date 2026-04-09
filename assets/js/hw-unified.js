import { hw, $, store, router } from './hw.js';

(function (w) {
	var d = w.document;
	var body = d.body;

	var slideWise = {
		rtl: ['slide-out-to-left', 'slide-in-from-right'],
		ltr: ['slide-out-to-right', 'slide-in-from-left'],
	};
	var slide = function (opts) {
		var inEl = opts['in'];
		var outEl = opts.out;
		var inClass = inEl.classList;
		var outClass = outEl.classList;
		var direction = opts.direction;
		var wise = slideWise[direction];
		var reset = function () {
			outClass.add('hidden');
			outClass.remove(wise[0]);
			inClass.remove(wise[1]);
		};
		inEl.addEventListener('animationend', reset, { once: true });
		inClass.remove('hidden');
		inClass.add(wise[1]);
		outClass.add(wise[0]);
	};

	var pop = function (opts) {
		var inEl = opts['in'];
		var outEl = opts.out;
		var inClass = inEl.classList;
		var outClass = outEl.classList;
		var direction = opts.direction;
		if (direction == 'up') {
			outClass.add('no-pointer');
			inClass.remove('hidden');
			inClass.add('slide-up');
		} else {
			var resetDown = function () {
				outClass.remove('slide-down');
				outClass.add('hidden');
				inClass.remove('no-pointer');
			};
			outEl.addEventListener('animationend', resetDown, { once: true });
			outClass.remove('slide-up');
			outClass.add('slide-down');
		}
	};

	var getScreenState = function () {
		return (body.offsetWidth || w.innerWidth) > 736 ? 'wide' : 'narrow';
	};

	// Set viewport meta
	var vmeta = d.querySelector('meta[name=viewport]');
	if (!vmeta) {
		vmeta = d.createElement('meta');
		vmeta.name = 'viewport';
		d.head.appendChild(vmeta);
	}
	vmeta.content = 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0';

	// Wide screen state
	var isWideScreen = getScreenState() == 'wide';
	w.addEventListener('resize', function () {
		var wide = getScreenState() == 'wide';
		if (wide != isWideScreen) {
			isWideScreen = wide;
			location.reload();
		}
	});

	// Overlay for wide screen
	if (isWideScreen) body.insertAdjacentHTML('beforeend', '<div id="overlay" class="hide"></div>');

	// Detect swiping from screen edges (back/forward nav)
	var swipeNav = false;
	d.addEventListener('touchstart', function (e) {
		var touch = e.targetTouches[0];
		var x = touch.clientX;
		if (x < 20 || x > w.innerWidth - 20) swipeNav = true;
	});
	d.addEventListener('touchend', function () {
		swipeNav = false;
	});

	router.config({
		before: function (path, name, matches) {
			var previousView = (hw.previousView = hw.currentView);
			var currentView = (hw.currentView = name);
			var hideAllViews = hw.hideAllViews;
			var view = $('view-' + currentView);
			hw.setTitle(view.querySelector('header h1').textContent);

			switch (currentView) {
				case 'home':
					if (!isWideScreen) {
						if (previousView == 'comments' && !swipeNav) {
							slide({
								in: view,
								out: $('view-' + previousView),
								direction: 'ltr',
							});
						} else if (previousView == 'about' && !swipeNav) {
							pop({
								in: view,
								out: $('view-' + previousView),
								direction: 'down',
							});
						} else {
							hideAllViews();
							view.classList.remove('hidden');
						}
					} else {
						hideAllViews();
						$('overlay').classList.add('hide');
						view.classList.remove('hidden');
						var viewComments = $('view-comments');
						viewComments.classList.remove('hidden');
						viewComments.querySelector('section').innerHTML =
							'<div class="view-blank-state"><div class="view-blank-state-text">No Story Selected.</div></div>';
						viewComments.querySelector('header h1').innerHTML = '';
						viewComments.querySelector('header a.header-back-button').style.display = 'none';
						hw.comments.currentID = null;
						hw.pub('selectCurrentStory');
					}
					break;
				case 'about':
					if (!isWideScreen) {
						if (previousView == 'home' && !swipeNav) {
							pop({
								in: view,
								out: $('view-' + previousView),
								direction: 'up',
							});
						} else {
							hideAllViews();
							var $viewHome = $('view-home');
							$viewHome.classList.remove('hidden');
							view.classList.remove('hidden');
						}
					} else {
						view.classList.remove('hidden');
						$('view-home').classList.remove('hidden');
						$('view-comments').classList.remove('hidden');
						setTimeout(function () {
							$('overlay').classList.remove('hide');
						}, 1);
					}
					break;
				case 'comments':
					if (!isWideScreen) {
						if (previousView == 'home' && !swipeNav) {
							var id = matches[1];
							if (id && hw.comments.currentID != id) view.querySelector('section').scrollTop = 0;
							slide({
								in: view,
								out: $('view-' + previousView),
								direction: 'rtl',
							});
						} else {
							hideAllViews();
							view.classList.remove('hidden');
						}
					} else {
						hideAllViews();
						$('overlay').classList.add('hide');
						view.classList.remove('hidden');
						$('view-home').classList.remove('hidden');
						hw.pub('selectCurrentStory', matches[1]);
						view.querySelector('header a.header-back-button').style.display = '';
					}
					break;
			}
		},
	});

	// Remember scroll tops of each view
	w.addEventListener(
		'pagehide',
		function () {
			var views = d.querySelectorAll('.view'),
				hackerScrollTops = {};
			for (var i = 0, l = views.length; i < l; i++) {
				var view = views[i];
				hackerScrollTops[view.id] = view.querySelector('.scroll section').scrollTop || 0;
			}
			store('hacker-scrolltops', hackerScrollTops);
		},
		false,
	);
	var restoreScrollTops = function () {
		var hackerScrollTops = store('hacker-scrolltops');
		for (var id in hackerScrollTops) {
			var section = $(id).querySelector('.scroll section');
			section.scrollTop = hackerScrollTops[id];
		}
	};
	w.addEventListener('pageshow', restoreScrollTops, false);
	restoreScrollTops();

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
		var hash = target.hash;
		if (isWideScreen && /about/i.test(router.current) && hash == '#/') {
			router.back('/');
		} else {
			location.hash = hash;
		}
	});

	// Refresh button
	on('#view-home-refresh', 'click', function (e) {
		e.preventDefault();
		hw.news.reload();
	});

	// Scroll to top on header h1 tap
	on('.view>header h1', 'click', function (e, target) {
		var section = target.parentNode.nextElementSibling.firstElementChild;
		if (section.scrollTop == 0) return;
		section.scrollTo({ top: 0, behavior: 'smooth' });
	});

	// Story list clicks
	on('#view-home .tableview-links li>a:first-child', 'click', function (e, target) {
		if (target.classList.contains('more-link')) {
			e.preventDefault();
			hw.news.more(target);
		} else if (/^#\//.test(target.getAttribute('href'))) {
			e.preventDefault();
			location.hash = target.hash;
		} else if (target.href && isWideScreen) {
			e.preventDefault();
			w.open(target.href);
		}
	});

	// Detail disclosure button
	on('#view-home .tableview-links li>a.detail-disclosure-button', 'click', function (e, target) {
		e.preventDefault();
		if (hw.currentView == 'comments') return;
		location.hash = target.hash;
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

	// Select current story in wide screen
	hw.sub('selectCurrentStory', function (id) {
		if (!isWideScreen) return;
		if (!id) id = (location.hash.match(/item\/(\d+)/) || [, ''])[1];
		var homeView = $('view-home');
		var selectedLinks = homeView.querySelectorAll('a[href].selected');
		for (var i = 0, l = selectedLinks.length; i < l; i++) {
			selectedLinks[i].classList.remove('selected');
		}
		if (!id) return;
		var link = homeView.querySelector('a[href*="item/' + id + '"]');
		if (link) {
			link.classList.add('selected');
			setTimeout(function () {
				link.scrollIntoView({ block: 'nearest' });
			}, 1);
		}
	});
	hw.sub('onRenderNews', function () {
		hw.pub('selectCurrentStory');
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

	// Make about dialog animated after 400ms, for widescreen
	if (isWideScreen)
		setTimeout(function () {
			$('view-about').classList.add('animated');
		}, 400);

	hw.news.options.disclosure = !isWideScreen;
	hw.init();
})(window);
