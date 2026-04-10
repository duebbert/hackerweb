const timeout = 20000 // 20 seconds

const req = function (url, success, error) {
	if (!success)
		success = function () {
			/* noop */
		}
	if (!error)
		error = function () {
			/* noop */
		}

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
		.then(success)
		.catch(function (e) {
			clearTimeout(timer)
			error(e)
		})
}

const urls = [
	'https://node-hnapi-eu.herokuapp.com/', // Heroku (EU)
	'https://node-hnapi.azurewebsites.net/', // Windows Azure (North EU)
	'https://node-hnapi-eus.azurewebsites.net/', // Windows Azure (East US)
]
const shuffle = function (array) {
	// Fisher-Yates
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const temp = array[i]
		array[i] = array[j]
		array[j] = temp
	}
}
shuffle(urls)
urls.unshift('https://api.hackerwebapp.com/') // The ultimate API

const length = urls.length
const reqAgain = function (i, path, success, error) {
	const errorFunc =
		i < length - 1
			? function () {
					reqAgain(i + 1, path, success, error)
				}
			: error
	req(urls[i] + path, success, errorFunc)
}
const reqs = function (path, success, error) {
	req(urls[0] + path, success, function () {
		reqAgain(1, path, success, error)
	})
}

const hnapi = {
	urls: urls,

	news: function (success, error) {
		reqs('news', success, error)
	},

	news2: function (success, error) {
		reqs('news2', success, error)
	},

	item: function (id, success, error) {
		reqs('item/' + id, success, error)
	},

	comments: function (id, success, error) {
		reqs('comments/' + id, success, error)
	},
}

export default hnapi
