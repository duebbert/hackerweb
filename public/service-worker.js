var CACHE_NAME = 'hackerweb-v2'
var APP_SHELL = ['/', '/manifest.json', '/icons/icon.svg']

self.addEventListener('install', function (event) {
	event.waitUntil(
		caches.open(CACHE_NAME).then(function (cache) {
			return cache.addAll(APP_SHELL)
		}),
	)
	self.skipWaiting()
})

self.addEventListener('activate', function (event) {
	event.waitUntil(
		caches.keys().then(function (keys) {
			return Promise.all(
				keys
					.filter(function (k) {
						return k.startsWith('hackerweb-') && k !== CACHE_NAME
					})
					.map(function (k) {
						return caches.delete(k)
					}),
			)
		}),
	)
	self.clients.claim()
})

self.addEventListener('fetch', function (event) {
	var url = new URL(event.request.url)

	// API requests: network-first with cache fallback
	if (
		url.hostname === 'hacker-news.firebaseio.com' ||
		url.hostname === 'hn.algolia.com'
	) {
		event.respondWith(
			fetch(event.request)
				.then(function (response) {
					if (response.ok) {
						var clone = response.clone()
						caches.open(CACHE_NAME).then(function (cache) {
							cache.put(event.request, clone)
						})
					}
					return response
				})
				.catch(function () {
					return caches.match(event.request)
				}),
		)
		return
	}

	// App shell and assets: cache-first with background network update
	event.respondWith(
		caches.match(event.request).then(function (cached) {
			var fetchPromise = fetch(event.request)
				.then(function (response) {
					if (response.ok) {
						var clone = response.clone()
						caches.open(CACHE_NAME).then(function (cache) {
							cache.put(event.request, clone)
						})
					}
					return response
				})
				.catch(function () {
					return undefined
				})

			return cached || fetchPromise
		}),
	)
})
