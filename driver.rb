#ruby driver of the AVC
#Prior to using, 1) gem install sys-proctable
#2) go to about:config of FF using the profile and type toolkit.startup.max_resumed_crashes in the search box. Set this value to -1/999999(very large number)

require 'sys/proctable'
include Sys

SLEEPTIME = 1200		#configurable: timeout.

def kill_process(pid)
	to_kill = Array.new
	to_kill.push(pid)
	ProcTable.ps do |proc|
		to_kill << proc.pid if to_kill.include?(proc.ppid)
	end
	Process.kill(9, *to_kill)
end

pid = spawn "cfx run -p vulCheckerProfile"

currentFileCount = Dir.entries("vulcheckerProfile/testResults/").length - 2		#. and .. doesn't count
previousFileCount = -1

while (true)
	if (File.exists?("vulcheckerProfile/testResults/finished.txt")) then exit end
	currentFileCount = Dir.entries("vulcheckerProfile/testResults/").length - 2		#. and .. doesn't count
	if (previousFileCount != currentFileCount)
		previousFileCount = currentFileCount
	else
		kill_process(pid)
		sleep(10)									# wait for the child processes to close
		pid = spawn "cfx run -p vulCheckerProfile"
	end
	sleep(SLEEPTIME)
end