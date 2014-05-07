A vul checker application.

Note:
Firefox needs to have popup blocking turned off (go to options to diable that)
and also caching turned off (got to about:config and type network.http.use-cache to disable it).
Also turn off auto crash report submit by going to about:config and set toolkit.startup.max_resumed_crashes to -1.

Turn off Flash plugin if using addon SDK 1.14

modify addon-SDK-x.xx/python-lib/cuddlefish/prefs.py, find line 'javascript.options.strict': True 

and set it to False.

Set
devtools.chrome.enabled: true
devtools.debugger.remote-enabled: true
to enable debugging.

*Extra files*
configurations0.js -> configurations4.js
webServiceFile0.js -> webServiceFile2.js
dividedTestList.js
All above mentioned files go to lib/
See sample_extra_files_needed for more information.

Also requires localhost/bootstrap.html (can just be an empty file) to work.
Note: if localhost cannot host bootstrap.html, any other quick-responding sites would do, such as http://www.google.com/, however, connecting to a remote host is always going to be slower than localhost.

Without these files, SSOScan won't run correctly.

List of vulnerabilities SSOScan can detect:
[1] Misuse access_token to authenticate users.
[2] Although code is used, client side exchange of access_token is performed. This also exposes client secret in the traffic. Currently we detect visit to a particular URL for this vul.
[3] Although signed_request is used, server doesn't check the signature part.
[4] User credentials could be leaked through referrer header when requesting a third party content
[5] User credentials could be leaked if third party script could access HTML document.


Statistics scripts:

extractCSV.rb:  input: results.txt generated from automated testing. output: results.csv, a list of sites and their vul stats.  Missing data means it failed at some point.

combineCSV.rb:  input: results1.txt, results2.txt generated from 2 runs.  results1 should contain all sites result2 runs.  output:results_new.csv, combining the results of the two. also outputs allFailedSites.js like extractCSV.rb does.  Report if there is a disagreement on [1][2][3], but does not report if there's disagreement on [4][5].  In [4][5] there might be random detecting errors as well as different third-party content served each time, therefore it should be ignored and the combined results always will be vulnerable.  In [1][2][3] cases, output file will erase the value and add that to allFailedSites.js for next round of testing.

To generate AllfailedTest.js from a CSV, call combineCSV.rb with that CSV as first param and a empty file as the second param.

CSV auto code:
-1: vulnerable
1: not vulnerable
2: app FB configuration is detected to be in an error state.
3: oracle failed
4: doesn't support FB, shouldn't be here in the list. If this value is considered 4 for two consecutive times, it is removed from the list.

CSV manual intervention code:

10: Server side error in implementing FB connect.
11: Captchas needed.
12: Must link/subscribe.
13: Must verify email.
14: Actually no Facebook login.
15: Pre-populated fields contains error.
16: non-SSL registration form used.

20: Oracle problem
21: Timeout
22: Input cannot handle
23: Cannot find submit button
24: Other rare reasons
