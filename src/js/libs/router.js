// Simple hash router

const routes = []
const noop = function () {
	/* noop */
}
const options = {
	defaultPath: '/',
	before: noop,
	on: noop,
	notfound: noop,
}

const router = {
	current: null,
	previous: null,
	config: function (opts) {
		for (const o in opts) {
			if (Object.hasOwn(opts, o)) options[o] = opts[o]
		}
		return router
	},
	add: function (path, name, fn) {
		if (path && name) {
			if (typeof name === 'function') {
				fn = name
				name = null
			}
			routes.push({
				path: path,
				name: name,
				fn: fn || noop,
			})
		}
		return router
	},
	go: function (path) {
		location.hash = path
		return router
	},
	back: function (path) {
		if (router.previous) {
			history.back()
			router.previous = null
		} else if (path) {
			location.hash = path
		}
		return router
	},
}

const hashchange = function () {
	let hash = location.hash.slice(1)
	let found = false
	const current = router.current

	if (!hash) hash = options.defaultPath

	if (current && current !== router.previous) {
		router.previous = current
	}
	router.current = hash

	for (let i = 0, l = routes.length; i < l && !found; i++) {
		const route = routes[i]
		const path = route.path
		const name = route.name
		const fn = route.fn
		if (typeof path === 'string') {
			if (path.toLowerCase() === hash.toLowerCase()) {
				options.before.call(router, path, name)
				fn.call(router)
				options.on.call(router, path, name)
				found = true
			}
		} else {
			const matches = hash.match(path)
			if (matches) {
				options.before.call(router, path, name, matches)
				fn.apply(router, matches)
				options.on.call(router, path, name, matches)
				found = true
			}
		}
	}

	if (!found) options.notfound.call(router)

	return router
}

router.init = function () {
	window.addEventListener('hashchange', hashchange)
	return hashchange()
}
router.reload = hashchange

export default router
