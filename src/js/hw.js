import store from './libs/store.js';
import hnapi from './libs/hnapi.js';
import router from './libs/router.js';
import TEMPLATES from './templates.js';

var d = document;

var $ = function (id) {
	return d.getElementById(id);
};

var pubsubCache = {},
	clone = function (obj) {
		var target = {};
		for (var i in obj) {
			if (obj.hasOwnProperty(i)) target[i] = obj[i];
		}
		return target;
	};

var hw = {
	// PubSub
	pub: function (topic, data) {
		var t = pubsubCache[topic];
		if (!t) return;
		for (var i = 0, l = t.length; i < l; i++) {
			t[i].call(this, data);
		}
	},
	sub: function (topic, fn) {
		if (!pubsubCache[topic]) pubsubCache[topic] = [];
		pubsubCache[topic].push(fn);
	},
	currentView: null,
	hideAllViews: function () {
		var views = d.querySelectorAll('.view');
		for (var i = 0, l = views.length; i < l; i++) {
			views[i].classList.add('hidden');
		}
	},
	tmpl: function (template, data) {
		var t = TEMPLATES[template];
		if (!t) return;
		if (!data) return t;
		return t(data);
	},
	setTitle: function (str) {
		var title = 'HackerWeb';
		if (str) {
			str = str.replace(/^\s+|\s+$/g, ''); // trim
			if (str.toLowerCase() != title.toLowerCase()) {
				title = str + ' \u2013 ' + title;
			}
		}
		d.title = title;
	},
};

var tmpl = hw.tmpl;

// Fix browsers freak out of store.sessionStorage not a function
if (!store.sessionStorage || typeof store.sessionStorage != 'function') {
	store.sessionStorage = store.memory; // Fallback to in-memory storage
}

var linkElement = d.createElement('a');
var domainsCache = {};
var domainify = function (url) {
	var domained = domainsCache[url];
	if (domained) return domained;
	linkElement.href = url;
	var domain = linkElement.hostname.replace(/^www\./, '');
	var pathname = linkElement.pathname.replace(/^\//, '').split('/')[0];
	var pathnameLen = pathname.length;
	var firstPath =
		domain.length <= 25 && pathnameLen > 3 && pathnameLen <= 15 && /^[^0-9][^.]+$/.test(pathname)
			? '/' + pathname
			: '';
	domained = domain + firstPath;
	domainsCache[url] = domained;
	return domained;
};

// Search both news caches for a post by ID.
// Returns { post, cacheKey } or null.
var findCachedPost = function (id) {
	var caches = ['hacker-news', 'hacker-news2'];
	for (var c = 0; c < caches.length; c++) {
		var news = store(caches[c]);
		if (news) {
			for (var i = 0, l = news.length; i < l; i++) {
				if (id == news[i].id) return { post: news[i], cacheKey: caches[c], news: news };
			}
		}
	}
	return null;
};

var $homeScroll = d.querySelector('#view-home .scroll'),
	$homeScrollSection = $homeScroll.querySelector('section'),
	loadingNews = false;

hw.news = {
	options: {
		disclosure: true,
	},
	markupStory: function (item) {
		if (/^item/i.test(item.url)) {
			item.url = '#/item/' + item.id;
		} else {
			item.external = true;
			item.domain = domainify(item.url);
		}
		if (!hw.news.options.disclosure) {
			if (item.id) item.url = '#/item/' + item.id;
		} else {
			if (item.type == 'link') item.detail_disclosure = true;
			if (/^#\//.test(item.url)) {
				item.detail_disclosure = false;
				item.disclosure = true;
				item.domain = null;
			}
		}
		item.i_point = item.points == 1 ? 'point' : 'points';
		item.i_comment = item.comments_count == 1 ? 'comment' : 'comments';
		return tmpl('post', item);
	},
	markupStories: function (data, i) {
		var html = '';
		if (!i) i = 1;
		var markupStory = hw.news.markupStory;
		// Filter out stories with no comments unless the user opted out.
		// Default is on; localStorage value 'off' disables the filter.
		if (localStorage['hackerweb:options:hide-no-comments'] != 'off') {
			data = data.filter(function (item) {
				return item.comments_count > 0;
			});
		}
		data.forEach(function (item) {
			item.i = i++;
			html += markupStory(item);
		});
		return html;
	},
	// Re-markup the story item in the News list when
	// there's an update from specific API call of the item.
	// Make sure the title, points, comments count, etc matches.
	updateStory: function (story) {
		if (!story || !story.id) return;
		var id = story.id;
		var data = story.data;
		var cached = findCachedPost(id);
		if (!cached) return;
		var post = cached.post;
		// Pass in the possibly changed values
		var changed = false;
		['title', 'url', 'time_ago', 'comments_count', 'points'].forEach(function (key) {
			var val = data[key];
			if (post[key] != val) {
				post[key] = val;
				changed = true;
			}
		});
		if (!changed) return;
		// Update the news cache (post was mutated in-place within cached.news)
		store(cached.cacheKey, cached.news);
		// Update the story in the news list
		var storyEl = $('story-' + id);
		if (!storyEl) return;
		post.selected = !!storyEl.querySelector('a[href].selected');
		post.i = storyEl.dataset ? storyEl.dataset.index : storyEl.getAttribute('data-index');
		storyEl.insertAdjacentHTML('afterend', hw.news.markupStory(post));
		storyEl.parentNode.removeChild(storyEl);
	},
	render: function (opts) {
		if (loadingNews) return;
		if (!opts) opts = {};
		var cached = store('hacker-news-cached');
		var tmpl1 = tmpl('stories-load');
		var loadNews = function (_data) {
			var data = _data.slice();
			var html =
				'<ul class="tableview tableview-links" id="hwlist">' +
				hw.news.markupStories(data) +
				(store('hacker-news2')
					? '<li><a class="more-link">More&hellip;<span class="loader"><i class="icon-loading"></i></span></a></li>'
					: '') +
				'</ul>';
			$homeScrollSection.innerHTML = html;
			hw.pub('onRenderNews');
		};
		if (cached) {
			var news = store('hacker-news');
			var delay = opts.delay;
			if (delay) {
				loadingNews = true;
				$homeScrollSection.innerHTML = tmpl1({ loading: true });
				setTimeout(function () {
					loadingNews = false;
					loadNews(news);
				}, delay);
			} else {
				loadNews(news);
			}
		} else {
			loadingNews = true;
			$homeScrollSection.innerHTML = tmpl1({ loading: true });
			var showError = function () {
				$homeScrollSection.innerHTML = tmpl1({ load_error: true });
			};
			hnapi.news(
				function (data) {
					loadingNews = false;
					if (!data || data.error) {
						showError();
						return;
					}
					store('hacker-news', data);
					store('hacker-news-cached', true, {
						expires: 1000 * 60 * 10, // 10 minutes
					});
					store('hacker-news2', null);
					loadNews(data);
					// Preload news2 to prevent discrepancies between /news and /news2 results
					hnapi.news2(function (data) {
						if (!data || data.error) return;
						store('hacker-news2', data);
						$('hwlist').insertAdjacentHTML(
							'beforeend',
							'<li><a class="more-link">More&hellip;<span class="loader"></span></a></li>',
						);
					});
				},
				function (e) {
					loadingNews = false;
					showError();
				},
			);
		}
	},
	reload: function () {
		hw.news.render({
			delay: 300, // Cheat a little to make user think that it's doing something
		});
	},
	more: function (target) {
		if (target.classList.contains('loading')) return;
		target.classList.add('loading');
		var news2 = store('hacker-news2');
		setTimeout(function () {
			target.classList.remove('loading');
			var targetParent = target.parentNode;
			if (!targetParent) return;
			if (targetParent.parentNode) targetParent.parentNode.removeChild(targetParent);
			if (!news2) return;
			// Dedupe against stories already shown from the first page.
			var seen = {};
			var news1 = store('hacker-news') || [];
			for (var i = 0, l = news1.length; i < l; i++) seen[news1[i].id] = true;
			var data = news2.slice().filter(function (item) {
				return !seen[item.id];
			});
			var html = hw.news.markupStories(data, 31);
			$('hwlist').insertAdjacentHTML('beforeend', html);
		}, 400);
	},
};

var $commentsView = $('view-comments'),
	$commentsHeading = $commentsView.querySelector('header h1'),
	$commentsSection = $commentsView.querySelector('section');

hw.comments = {
	currentID: null,
	render: function (id) {
		if (!id) return;
		var post = store.sessionStorage('hacker-item-' + id);
		if (hw.comments.currentID == id && post) return;
		hw.comments.currentID = id;

		var loadPost = function (_data, id) {
			var data = clone(_data),
				tmpl1 = tmpl('post-comments');

			data.has_post = !!data.title;
			if (!data.has_post) {
				hw.setTitle();
				$commentsHeading.innerText = '';
				$commentsSection.innerHTML = tmpl1(data);
				hw.pub('onRenderComments');
				return;
			}

			// If "local" link, link to Hacker News web site
			if (/^item/i.test(data.url)) {
				data.url = '//news.ycombinator.com/' + data.url;
			} else {
				data.domain = domainify(data.url);
			}
			data.has_comments = data.comments && !!data.comments.length;
			data.i_point = data.points == 1 ? 'point' : 'points';
			data.i_comment = data.comments_count == 1 ? 'comment' : 'comments';
			data.has_content = !!data.content;
			if (data.poll) {
				var total = 0;
				var max = 0;
				data.poll.forEach(function (p) {
					var points = p.points;
					if (points > max) max = points;
					total += points;
					p.i_point = points == 1 ? 'point' : 'points';
				});
				data.poll.forEach(function (p) {
					var points = p.points;
					p.percentage = ((points / total) * 100).toFixed(1);
					p.width = ((points / max) * 100).toFixed(1) + '%';
				});
				data.has_poll = data.has_content = true;
			}
			data.short_hn_url = 'news.ycombinator.com/item?id=' + id;
			data.hn_url = '//' + data.short_hn_url;
			hw.setTitle(data.title);
			$commentsHeading.innerText = data.title;

			var html = tmpl1(data);
			var div = d.createElement('div');
			div.innerHTML = html;

			// Make all links open in new tab/window
			// If it's a comment permalink, link to HN
			var links = div.querySelectorAll('a');
			for (var i = 0, l = links.length; i < l; i++) {
				var link = links[i];
				link.target = '_blank';
			}

			// Highlight the OP
			var opUser = data.user;
			if (opUser) {
				var users = div.querySelectorAll('.user');
				for (var i = 0, l = users.length; i < l; i++) {
					var user = users[i];
					if (user.textContent.trim() == opUser) {
						user.classList.add('op');
						user.title = 'Original Poster';
					}
				}
			}

			// Add a collapse/expand toggle to every nested reply list.
			var subUls = div.querySelectorAll('.comments li > ul');
			for (var j = 0, l = subUls.length; j < l; j++) {
				var subUl = subUls[j],
					commentsCount = subUl.querySelectorAll('.metadata').length;
				if (commentsCount < 3) continue;
				subUl.style.display = 'none';
				subUl.insertAdjacentHTML(
					'beforebegin',
					'<button class="comments-toggle collapsed">' + commentsCount + ' replies</button>',
				);
			}

			$commentsSection.replaceChildren(...div.childNodes);

			hw.pub('onRenderComments');
		};

		if (post) {
			window.scrollTo(0, 0);
			loadPost(post, id);
		} else {
			var cached = findCachedPost(id);
			if (cached) post = cached.post;
			if (post) {
				post.loading = true;
				loadPost(post, id);
			} else {
				loadPost({ loading: true }, id);
			}
			var showError = function () {
				if (post) {
					delete post.loading;
					post.load_error = true;
					loadPost(post, id);
				} else {
					loadPost({ load_error: true }, id);
				}
			};
			hnapi.item(
				id,
				function (data) {
					if (hw.comments.currentID != id) return;
					if (!data || (data.error && hw.currentView == 'comments')) {
						showError();
						return;
					}
					store.sessionStorage('hacker-item-' + id, data, {
						expires: 1000 * 60 * 5, // 5 minutes
					});
					hw.news.updateStory({
						id: id,
						data: data,
					});
					loadPost(data, id);
				},
				function (e) {
					if (hw.comments.currentID != id) return;
					showError();
				},
			);
		}
	},
	toggle: function (target) {
		var ul = target.nextElementSibling;
		if (ul) {
			var ulStyle = ul.style;
			var top = window.pageYOffset || document.documentElement.scrollTop || 0;
			var collapsed = ulStyle.display != 'none';
			ulStyle.display = collapsed ? 'none' : '';
			if (collapsed) {
				target.classList.add('collapsed');
			} else {
				target.classList.remove('collapsed');
			}
			window.scrollTo(0, top);
		}
	},
	collapseParent: function (target) {
		var li = target.closest('li');
		if (!li) return;
		var parentUl = li.parentNode;
		if (!parentUl || parentUl.tagName != 'UL') return;
		var grandparentLi = parentUl.parentNode;
		if (!grandparentLi || grandparentLi.tagName != 'LI') return;
		parentUl.style.display = 'none';
		var toggleBtn = parentUl.previousElementSibling;
		if (toggleBtn && toggleBtn.classList && toggleBtn.classList.contains('comments-toggle')) {
			toggleBtn.classList.add('collapsed');
		} else {
			var commentsCount = parentUl.querySelectorAll('.metadata').length;
			var replyWord = commentsCount == 1 ? 'reply' : 'replies';
			parentUl.insertAdjacentHTML(
				'beforebegin',
				'<button class="comments-toggle collapsed">' + commentsCount + ' ' + replyWord + '</button>',
			);
		}
		if (grandparentLi.scrollIntoView) {
			grandparentLi.scrollIntoView({ block: 'start' });
		}
	},
	reload: function () {
		hw.comments.currentID = null;
		router.reload();
	},
};

hw.init = function () {
	hw.news.render();
	router.init();

	var colorSchemeRetries = 0;
	function renderColorScheme() {
		var cssRule = null;
		var sheets = document.styleSheets;
		for (var i = 0; i < sheets.length && !cssRule; i++) {
			try {
				var rules = sheets[i].cssRules;
				for (var j = 0; j < rules.length; j++) {
					if (rules[j].media && /color-scheme:\s*dark/i.test(rules[j].media.mediaText)) {
						cssRule = rules[j];
						break;
					}
				}
			} catch (e) {
				// Skip cross-origin stylesheets
			}
		}
		if (!cssRule) {
			if (++colorSchemeRetries < 10) setTimeout(renderColorScheme, 1000);
			return;
		}
		if (cssRule) {
			$('hw-appearance-container').hidden = false;
			var $hwAppearance = $('hw-appearance');
			var $metaColorScheme = $('meta-color-scheme');
			var prefersColorSchemeSupported =
				window.matchMedia && window.matchMedia('(prefers-color-scheme)').media !== 'not all';
			var appearanceStorageKey = 'hw-appearance';
			var appearance = localStorage.getItem(appearanceStorageKey) || 'auto';

			function setAppearance(appearance) {
				if (appearance === 'dark') {
					cssRule.media.mediaText = 'screen';
					$metaColorScheme.content = 'dark';
				} else if (appearance === 'light') {
					cssRule.media.mediaText = 'not all';
					$metaColorScheme.content = 'light';
				} else {
					cssRule.media.mediaText = '(prefers-color-scheme: dark)';
					$metaColorScheme.content = 'dark light';
				}
			}
			setAppearance(appearance);

			if (prefersColorSchemeSupported) {
				$hwAppearance.querySelector('[name=hw-appearance][value=auto]').parentNode.hidden = false;
				var input = $hwAppearance.querySelector('[name=hw-appearance][value=' + appearance + ']');
				input.checked = true;
			} else {
				if (!/(light|dark)/i.test(appearance)) {
					appearance = 'light';
				}
				var input = $hwAppearance.querySelector('[name=hw-appearance][value="' + appearance + '"]');
				input.checked = true;
			}
			$hwAppearance.onclick = function () {
				var checkedInput = $hwAppearance.querySelector('[name=hw-appearance]:checked');
				var appearance = checkedInput.value;
				localStorage.setItem(appearanceStorageKey, appearance);
				setAppearance(appearance);
			};
		}
	}
	renderColorScheme();

	// "Hide stories with no comments" toggle on the About page.
	var $hideNoComments = $('hw-hide-no-comments');
	if ($hideNoComments) {
		var hideKey = 'hackerweb:options:hide-no-comments';
		var current = localStorage[hideKey] == 'off' ? 'off' : 'on';
		var input = $hideNoComments.querySelector(
			'[name=hw-hide-no-comments][value="' + current + '"]',
		);
		if (input) input.checked = true;
		$hideNoComments.onclick = function () {
			var checked = $hideNoComments.querySelector('[name=hw-hide-no-comments]:checked');
			if (!checked) return;
			if (checked.value == 'off') {
				localStorage[hideKey] = 'off';
			} else {
				delete localStorage[hideKey];
			}
			var wasExpanded = !!(d.getElementById('hwlist') && !d.querySelector('#hwlist .more-link'));
			hw.news.render();
			if (wasExpanded) {
				var list = d.getElementById('hwlist');
				var moreLi = list && list.querySelector('.more-link');
				if (moreLi && moreLi.parentNode) hw.news.more(moreLi);
			}
		};
	}
};

router
	.config({
		notfound: function () {
			router.go('/');
		},
	})
	.add('/', 'home')
	.add('/about', 'about')
	.add(/^\/item\/(\d+)$/i, 'comments', function (path, id) {
		hw.comments.render(id);
	});

export { hw, $, store, router };
