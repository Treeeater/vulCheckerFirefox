A vul checker application.

Note:
Firefox needs to have popup blocking turned off (go to options to diable that)
and also caching turned off (got to about:config and type network.http.use-cache to disable it).

Known bugs (and probably not gonna fix):

1) If the website displays login button on the homepage in an iframe, ccc cannot capture its XPath and correctly clicks it two times, because pressLoginButtonIFrame.js completely works on its own, it simply asks ccc if it needs to find and click the login button, but never returns any information about the button it clicked.

