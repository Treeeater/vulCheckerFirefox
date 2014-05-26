if (ARGV.length != 1)
	p "wrong number of arguments. needs 1"
	exit 
end

inputFileName = ARGV[0]
hash = Hash.new

text = File.open(inputFileName).read

text.each_line do |line|
	if line.match(/(.*?)\sis\snot\svulnerable\sto\s\[(\d)\].*?\n/)
		if (hash[$1]==nil) then hash[$1] = Array.new end
		(hash[$1])[$2.to_i-1] = 1
	end
	if line.match(/(.*?)\sis\svulnerable\sto\s\[(\d)\].*?\n/)
		if (hash[$1]==nil) then hash[$1] = Array.new end
		(hash[$1])[$2.to_i-1] = -1
	end
end
#the above sites are for sure supporting FB

#the below sites stalled at phase 2 or 3, so we don't really know:
dnsErrorArrayTemp = Array.new
dnsErrorArray = Array.new
stalledTemp = Array.new
stalled = Array.new
currentSite = ""
appID = Hash.new
allSites = Array.new
errorStateApp = Array.new
doesNotSupportFB = Array.new
oracleFailedArray = Array.new
text.each_line do |line|
	if line.start_with? "Testing site:"
		currentSite = line[14..-1].chomp
		allSites.push(currentSite)
	end
	if line.start_with? "App_ID: "
		appID[currentSite] = line[9..-1].chomp
	end
	if (line.include?("Test stalled at Phase 0\n") || line.include?("Test stalled at Phase 1\n"))
		if !dnsErrorArrayTemp.include?(currentSite)
			dnsErrorArrayTemp.push(currentSite)
		else
			dnsErrorArray.push(currentSite)
		end
	end
	if (line.include? "Test stalled at Phase ")
		if (!stalledTemp.include?(currentSite))
			stalledTemp.push(currentSite)
		else 
			stalled.push(currentSite) 
		end
	end
	if (line.include? "oracle failed")
		oracleFailedArray.push(currentSite)
	end
	if (line.include? "Site support FB but its configuration is in an error state")
		errorStateApp.push(currentSite)
	end
	if (line.include? "Site doesn't support FB login?")
		doesNotSupportFB.push(currentSite)
	end
end

stalled.uniq!
dnsErrorArray.uniq!
allSites.uniq!
errorStateApp.uniq!
doesNotSupportFB.uniq!
oracleFailedArray.uniq!

p "Total sites reported: #{allSites.length}"
p "Total DNS resolving error reported: #{dnsErrorArray.length}"
p "Total app in error state reported: #{errorStateApp.length}"
p "Total app that doesn't support FB: #{doesNotSupportFB.length}"
p "Total app that reported with an oracle failure: #{oracleFailedArray.length}"

dnsErrorArray.each{|url|
	if (stalled.include? url)
		stalled.delete url
		next
	end
}

stalled.each{|url|
	if (!hash.has_key? url)
		hash[url]=Array.new
		hash[url][0] = ""
		hash[url][1] = ""
		hash[url][2] = ""
		hash[url][3] = ""
		hash[url][4] = ""
	end
}

errorStateApp.each{|url|
	hash[url]=Array.new
	hash[url][0] = 2
	hash[url][1] = 2
	hash[url][2] = 2
	hash[url][3] = 2
	hash[url][4] = 2
}

oracleFailedArray.each{|url|
	#Only fill in the blanks.
	if (!hash.has_key? url) then hash[url] = Array.new end
	if (hash[url][0] == "" || hash[url][0] == nil) then hash[url][0] = 3 end
	if (hash[url][1] == "" || hash[url][1] == nil) then hash[url][1] = 3 end
	if (hash[url][2] == "" || hash[url][2] == nil) then hash[url][2] = 3 end
	if (hash[url][3] == "" || hash[url][3] == nil) then hash[url][3] = 3 end
	if (hash[url][4] == "" || hash[url][4] == nil) then hash[url][4] = 3 end
}

doesNotSupportFB.each{|url|
	hash[url]=Array.new
	hash[url][0] = 4
	hash[url][1] = 4
	hash[url][2] = 4
	hash[url][3] = 4
	hash[url][4] = 4
}

#output
outputText = "AppID,Site URL,token vul,secret vul,signed_request vul,referrer vul,DOM vul\n"
completedCases = 0
failedCasesToTestNext = Array.new
hash.each_key{|k|
	if (hash[k][0].to_s!="" && hash[k][1].to_s!="" && hash[k][2].to_s!="" && hash[k][3].to_s!="" && hash[k][4].to_s!="") 
		completedCases+=1 
	else
		failedCasesToTestNext.push(k)
	end
	outputText = outputText + (appID[k]==nil ? "unknown":appID[k]) + ',' + k + ',' + hash[k][0].to_s + ',' + hash[k][1].to_s + ',' + hash[k][2].to_s + ',' + hash[k][3].to_s + ',' + hash[k][4].to_s + "\n"
}
p "total completed tests: #{completedCases}"
File.open("Results.csv","w+"){|f|
	f.write(outputText)
}

outputText = "exports.testList = ["

failedCasesToTestNext.each do |site|
	outputText += "'#{site}',"
end

outputText = outputText[0..-2] + "];"
File.open("allFailedSites.js","w+"){|f|
	f.write(outputText)
}



