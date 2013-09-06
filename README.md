A vul checker application.

Note:
Firefox needs to have popup blocking turned off (go to options to diable that)
and also caching turned off (got to about:config and type network.http.use-cache to disable it).

Known bugs (and probably not gonna fix):

1) If the website displays login button on the homepage in an iframe, ccc cannot capture its XPath and correctly clicks it two times, because pressLoginButtonIFrame.js completely works on its own, it simply asks ccc if it needs to find and click the login button, but never returns any information about the button it clicked.

Vul list:
[1] Misuse access_token to authenticate users.
[2] Although code is used, client side exchange of access_token is performed. This also exposes client secret in the traffic. Currently we detect visit to a particular URL for this vul.
[3] Although signed_request is used, server doesn't check the signature part.
[4] User credentials could be leaked through referrer header when requesting a third party content
[5] User credentials could be leaked if third party script could access HTML document.


Scripts:

extractCSV.rb:  input: results.txt generated from automated testing. output: results.csv, a list of sites and their vul stats.  Missing data means it failed at some point.

combineCSV.rb:  input: results1.txt, results2.txt generated from 2 runs.  output:results_new.csv, combining the results of the two.  Report if there is a disagreement on [1] [3], but does not report if there's disagreement on [2][4][5].  In [2][4][5] there might be random detecting errors as well as different third-party content served each time, therefore it should be ignored and the combined results always will be vulnerable.