// Simple hash router replacing ruto.js

var routes = [];
var noop = function () {};
var options = {
	defaultPath: '/',
	before: noop,
	on: noop,
	notfound: noop,
};

var router = {
	current: null,
	previous: null,
	config: function (opts) {
		for (var o in opts) {
			if (opts.hasOwnProperty(o)) options[o] = opts[o];
		}
		return router;
	},
	add: function (path, name, fn) {
		if (path && name) {
			if (typeof name == 'function') {
				fn = name;
				name = null;
			}
			routes.push({
				path: path,
				name: name,
				fn: fn || function () {},
			});
		}
		return router;
	},
	go: function (path) {
		location.hash = path;
		return router;
	},
	back: function (path) {
		if (router.previous) {
			history.back();
			router.previous = null;
		} else if (path) {
			location.hash = path;
		}
		return router;
	},
};

var hashchange = function () {
	var hash = location.hash.slice(1);
	var found = false;
	var current = router.current;

	if (!hash) hash = options.defaultPath;

	if (current && current != router.previous) {
		router.previous = current;
	}
	router.current = hash;

	for (var i = 0, l = routes.length; i < l && !found; i++) {
		var route = routes[i];
		var path = route.path;
		var name = route.name;
		var fn = route.fn;
		if (typeof path == 'string') {
			if (path.toLowerCase() == hash.toLowerCase()) {
				options.before.call(router, path, name);
				fn.call(router);
				options.on.call(router, path, name);
				found = true;
			}
		} else {
			var matches = hash.match(path);
			if (matches) {
				options.before.call(router, path, name, matches);
				fn.apply(router, matches);
				options.on.call(router, path, name, matches);
				found = true;
			}
		}
	}

	if (!found) options.notfound.call(router);

	return router;
};

router.init = function () {
	window.addEventListener('hashchange', hashchange);
	return hashchange();
};
router.reload = hashchange;

export default router;
