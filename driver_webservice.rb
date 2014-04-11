#ruby driver of the AVC
#Prior to using, 1) gem install sys-proctable
#2) go to about:config of FF using the profile and type toolkit.startup.max_resumed_crashes in the search box. Set this value to -1/999999(very large number)

require 'sys/proctable'
require 'fileutils'
require 'mysql2'
include Sys
require 'rbconfig'
require 'mail'
is_windows = (RbConfig::CONFIG['host_os'] =~ /mswin|mingw|cygwin/)

SLEEPTIME = 1500		#configurable: timeout.

def kill_process(pid)
	to_kill = Array.new
	to_kill.push(pid)
	ProcTable.ps do |proc|
		to_kill << proc.pid if to_kill.include?(proc.ppid)
	end
	Process.kill(9, *to_kill)
end

def kill_process_by_name(pname)
	to_kill = Array.new
	ProcTable.ps do |proc|
		to_kill << proc.pid if pname.downcase == proc.comm.downcase
	end
	to_kill.each{|p|
		begin
			kill_process(p)
		rescue
		end
	}
end


def sendMail(recipient, title, message)
	begin
		Mail.deliver do
		   from    'ssoscan@gmail.com'
		   to      recipient
		   subject title
		   body    message
		end
	rescue
	end
end

if (!Dir.exists?("vulCheckerProfile0"))
	p "No bootstrapping profile, create one and re-run this script"
	p "Make sure the caching, popup blocker and crash reports are all turned off."
	exit
end

options = { :address              => "smtp.gmail.com",
            :port                 => 587,
            :domain               => 'gmail.com',
            :user_name            => 'ssoscan@gmail.com',
            :password             => 'securitygroup',
            :authentication       => 'plain',
            :enable_starttls_auto => true  }
			
Mail.defaults do
  delivery_method :smtp, options
end

totalSessions = 3

i = 0

initialContent = <<-STR
var CONST = require('./const');

exports.debug = false;
exports.writeFlag = true;
exports.automatedTestingFlag = true;
exports.tryFindInvisibleLoginButton = false;
exports.registrationNeeded = false;
exports.searchForSignUpForFB = false;
exports.cleanResultDirectoryUponInit = true;
exports.webService = true;

exports.SubmitButtonClickDepth = 2;
exports.LoginButtonCandidateSize = 32;
exports.SubmitButtonCandidateSize = 2;

exports.USENIX = {experiments: {recordLoginButton: false, testRegistrationNeeded:false, exhaustiveSearchAndRecord:false, searchLoginButtonOnly:false}};

exports.detectionMode = CONST.dm.access_token_vul | CONST.dm.code_vul | CONST.dm.signed_request_vul | CONST.dm.referrer_vul | CONST.dm.secret_in_body_vul;
//auto generated below
//------------------
STR

configurationContent = initialContent

while (i < totalSessions)
	if (!File.exists?("./lib/webServiceFile#{i}"))
		File.open("./lib/webServiceFile#{i}.js","w+"){|f|}		#just touch all of them.
	end
	if (Dir.exists?("vulCheckerProfile#{i}/testResults"))
		FileUtils.rm_rf("vulCheckerProfile#{i}/testResults")
	end
	FileUtils.mkdir_p("vulCheckerProfile#{i}/testResults")
	if (!Dir.exists?("vulCheckerProfile#{i}"))
		FileUtils.mkdir_p("vulCheckerProfile#{i}")
		FileUtils.cp_r(Dir["vulCheckerProfile0/."],"vulCheckerProfile#{i}")
	end
	i+=1
end

pid_session = Array.new
randomhash_session = Array.new
time_session = Array.new
email_session = Array.new
URL_session = Array.new
remainingSessions = Array.new
for i in 0..totalSessions-1
	remainingSessions.push(i)
end
finishedpid_session = Array.new
client = Mysql2::Client.new(:host => "localhost", :username => "root", :password => "ssoscan", :database => "jobs")
i = 0

#check if we lost track of any jobs when we restart the service
client.query("UPDATE `jobs` SET `started`=0, `startTime`='' WHERE `started`='1' AND done != '1'")

while (true)
	#kill any crashreporter.exe launched in this period.
	kill_process_by_name("crashreporter.exe")
	#reclaim completed jobs first.
	for i in 0..totalSessions-1
		if (remainingSessions.include? i) then next end			#we only reclaim running (and finished) sessions.
		if (File.exists?("vulCheckerProfile#{i}/testResults/finished.txt"))
			begin
				kill_process(pid_session[i])
				sleep(5)
			rescue Errno::ESRCH
			end
			if (!File.exists?("vulCheckerProfile#{i}/testResults/results.txt"))
				#shouldn't happen at any time, panic.
				client.query("UPDATE jobs SET done=1, finishTime='#{Time.new}', errorcode=32 WHERE randomhash='#{randomhash_session[i]}'")
			else
				results = client.query("SELECT * FROM jobs WHERE randomhash='#{randomhash_session[i]}'")
				retries = 999
				if (results.count > 0)
					results.each{|r|
						retries = r["retries"].to_i
					}
				end
				resultsFH = File.open("vulCheckerProfile#{i}/testResults/results.txt")
				text = resultsFH.read
				resultsFH.close
				tempArray = [0,0,0,0,0]
				errorcode = 0
				text.each_line do |line|
					if line.chomp == "Site support FB but its configuration is in an error state."
						errorcode |= 1
					end
					if line.match(/(.*?)failed because oracle failed though we are able to login.\n/)
						errorcode |= 2
					end
					if line.chomp == "Site doesn't support FB login?"
						errorcode |= 4
					end
					if line.chomp == "Test failed a second time due to timeout, skipping this..."
						errorcode |= 8
					end
					if line.chomp == "Cannot register this site when searching for signup button... Give up." || line.chomp == "Signup button search doesn't help, test still fails." || line.match(/.*used to work for.*\n/)
						errorcode |= 16
					end
					if line.match(/(.*?)\sis\snot\svulnerable\sto\s\[(\d)\].*?\n/)
						tempArray[$2.to_i-1] = 1
					end
					if line.match(/(.*?)\sis\svulnerable\sto\s\[(\d)\].*?\n/)
						tempArray[$2.to_i-1] = -1
					end
				end
				if (errorcode > 1 && retries < 2)
					#restart it and wait for scheduler to pick it up again.
					queryString = "UPDATE `jobs` SET `started`=0 WHERE randomhash='#{randomhash_session[i]}'"
					client.query(queryString)
				else
					queryString = "UPDATE `jobs` SET `done`=1, `finishTime`='#{Time.new}', `errorcode`=#{errorcode}"
					if (tempArray[0] != 0) then queryString += " , `vul1`=#{tempArray[0]}" end
					if (tempArray[1] != 0) then queryString += " , `vul2`=#{tempArray[1]}" end
					if (tempArray[2] != 0) then queryString += " , `vul3`=#{tempArray[2]}" end
					if (tempArray[3] != 0) then queryString += " , `vul4`=#{tempArray[3]}" end
					if (tempArray[4] != 0) then queryString += " , `vul5`=#{tempArray[4]}" end
					queryString += " WHERE randomhash='#{randomhash_session[i]}'"
					client.query(queryString)
					msgBody = "Dear developer,\n\tThe requested scan on #{URL_session[i]} has completed.  Please visit <a href=\"http://www.ssoscan.org/result.py?testID=#{randomhash_session[i]}\">here</a> to view the results.\n\tIf you have any questions regarding this, do not reply to this email, instead, contact SSOScan's developers: Yuchen Zhou (yuchen@virginia.edu).\n\tThanks,\n--SSOScan @ University of Virginia"
					if email_session[i]!=""
						sendMail(email_session[i], "Test results for " + URL_session[i] + " is ready", msgBody)
					end
					if ((errorcode & 2 == 2) || (errorcode & 8 == 8) || (errorcode & 16 == 16))
						sendMail("pinkforpeace@gmail.com", "#{URL_session[i]} has problem EC##{errorcode}", "EC##{errorcode}")
					end
				end
			end
			FileUtils.rm_rf("vulCheckerProfile#{i}/testResults")			#clear results dir
			remainingSessions.push(i)
			p "Session #{i} finished."
		end
	end
	#check if any jobs exceeded timeout
	for i in 0..totalSessions-1
		if (remainingSessions.include? i) then next end			#we only check running sessions.
		if (Time.new - time_session[i] > 1500)					#25 min is maximum
			begin
				kill_process(pid_session[i])
				sleep(5)
			rescue Errno::ESRCH
			end
			results = client.query("SELECT * FROM jobs WHERE randomhash='#{randomhash_session[i]}'")
			retries = 999
			if (results.count > 0)
				results.each{|r|
					retries = r["retries"].to_i
				}
			end
			if (retries > 2)
				client.query("UPDATE jobs SET done=1, errorcode=64, finishTime='#{Time.new}' WHERE randomhash='#{randomhash_session[i]}'")
				FileUtils.rm_rf("vulCheckerProfile#{i}/testResults")			#clear results dir
				remainingSessions.push(i)
				msgBody = "Dear developer,\n\tThe requested scan on #{URL_session[i]} has timed out.  Please visit <a href=\"http://www.ssoscan.org/result.py?testID=#{randomhash_session[i]}\">here</a> to view detailed results.\n\tIf you have any questions regarding this, do not reply to this email, instead, contact SSOScan's developers: Yuchen Zhou (yuchen@virginia.edu).\n\tThanks,\n--SSOScan @ University of Virginia"
				sendMail(email_session[i], "Test results for " + URL_session[i] + " is ready", msgBody)
				p "Session #{i} timed out."
			else
				queryString = "UPDATE `jobs` SET `started`=0 WHERE randomhash='#{randomhash_session[i]}'"
				client.query(queryString)
			end
		end
	end
	#check if any jobs are resubmitted by the user or about to be retried.
	for i in 0..totalSessions-1
		if (remainingSessions.include? i) then next end			#we only check running sessions.
		url = URL_session[i]
		results = client.query("SELECT * FROM jobs WHERE URL='"+client.escape(url)+"' AND started=0")
		if results.count > 0
			#just terminate this job
			begin
				kill_process(pid_session[i])
				sleep(5)
			rescue Errno::ESRCH
			end
			FileUtils.rm_rf("vulCheckerProfile#{i}/testResults")			#clear results dir
			remainingSessions.push(i)
		end
	end
	results = client.query("SELECT * FROM jobs WHERE started != 1 AND retries < 2")
	#then reassign jobs to remainingSessions.
	if (results.count > 0 && remainingSessions.length > 0)
		results.each{|r|
			if (remainingSessions.length <= 0) then break end
			sessionNumber = remainingSessions.shift
			#write site to test info to that file first.
			stringToWrite = "exports.testList = ['"
			stringToWrite += r["URL"]
			stringToWrite += "'];"
			retries = r["retries"].to_i
			clickDepth = r["clickDepth"]
			candidateSize = r["candidateSize"]
			oracleURL = r["oracleURL"]
			tryUpperRightCorner = r["tryUpperRightCorner"]
			mustBeHostRelatedDomain = r["mustBeHostRelatedDomain"]
			configurationContent = initialContent
			configurationContent += "\nexports.LoginButtonClickDepth = #{clickDepth.to_i < 3 ? clickDepth : "3"};"
			configurationContent += "\nexports.maxCandidatesAllowedEachStrategy = #{candidateSize.to_i < 8 ? candidateSize : "8"};"
			configurationContent += "\nexports.oracleURL = #{oracleURL == '' ? "false" : ("'"+oracleURL+"'")};"
			configurationContent += "\nexports.tryUpperRightCorner = #{tryUpperRightCorner == 'on' ? 'true' : 'false'};"
			configurationContent += "\nexports.mustBeHostRelatedDomain = #{mustBeHostRelatedDomain=='on' ? 'true' : 'false'};"
			File.open("./lib/configuration#{sessionNumber}.js","w+"){|f| f.write(configurationContent)}
			FileUtils.rm_rf("vulCheckerProfile#{remainingSessions}/testResults")			#clear results dir
			File.open("./lib/webServiceFile#{sessionNumber}.js",'w+'){|f|
				f.write(stringToWrite)
			}
			
			#then spawn the child process
			if (is_windows) then pid_session[sessionNumber] = spawn("cfx run -p vulCheckerProfile#{sessionNumber}") else pid_session[sessionNumber] = spawn("cfx run -p vulCheckerProfile#{sessionNumber} -b ~/firefox/firefox") end
			randomhash_session[sessionNumber] = r["randomhash"]
			time_session[sessionNumber] = Time.new
			email_session[sessionNumber] = r["email"]
			URL_session[sessionNumber] = r["URL"]
			client.query("UPDATE `jobs` SET `started`=1, `retries`=#{retries+1}, `startTime`='#{time_session[sessionNumber]}' WHERE `randomhash`='#{client.escape(r["randomhash"])}'")
			p "Dispatched session #{sessionNumber} to handle #{r["URL"]}"
			sleep(5)		#wait for the process to spawn completely
		}
	end
	sleep(10)			#check db once 10 secs.
end