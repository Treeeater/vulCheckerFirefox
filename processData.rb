if (ARGV.length != 2)
	p "wrong number of arguments. needs 2"
	exit 
end

fileName = ARGV[0]

text = File.open(fileName).read
currentSite = ""
allTestSites = Array.new
failedArray = Array.new
dnsErrorArrayTemp = Array.new
dnsErrorArray = Array.new
oracleErrorArray = Array.new
supportFacebookSSO = Array.new
doesNotSupportFacebookSSO = Array.new
stalledAtAboveTwoPhases = Array.new
stalledAtAboveTwoPhasesTemp = Array.new
vul1 = Array.new
vul2 = Array.new
vul3 = Array.new
vul4 = Array.new
vul5 = Array.new
text.each_line do |line|
	if line.start_with? "Testing site:"
		currentSite = line[14..-1].chomp
		allTestSites.push(currentSite)
	end
	if line.include? "vulnerable"
		supportFacebookSSO.push(currentSite)
	end
	if line.include? "Site doesn't support FB login?"
		doesNotSupportFacebookSSO.push(currentSite)
	end
	if line.include? "is vulnerable to [1]"
		vul1.push(currentSite)
	end
	if line.include? "is vulnerable to [2]"
		vul2.push(currentSite)
	end
	if line.include? "is vulnerable to [3]"
		vul3.push(currentSite)
	end
	if line.include? "is vulnerable to [4]"
		vul4.push(currentSite)
	end
	if line.include? "is vulnerable to [5]"
		vul5.push(currentSite)
	end
	if line.include? "fail"
		failedArray.push(currentSite)
	end
	if ((line.include?("Test stalled at Phase 0\n") || line.include?("Test stalled at Phase 1\n")) && !dnsErrorArrayTemp.include?(currentSite))
		dnsErrorArrayTemp.push(currentSite)
		next
	end
	if ((line.include?("Test stalled at Phase 0\n") || line.include?("Test stalled at Phase 1\n")) && (dnsErrorArrayTemp.include? currentSite))
		dnsErrorArray.push(currentSite)
		next
	end
	if (line.include? "Test stalled at Phase ")
		if (!stalledAtAboveTwoPhasesTemp.include?(currentSite))
			stalledAtAboveTwoPhasesTemp.push(currentSite) 
			next
		end
	end
	if (line.include? "Test stalled at Phase ")
		if (stalledAtAboveTwoPhasesTemp.include?(currentSite))
			stalledAtAboveTwoPhases.push(currentSite) 
			next
		end
	end
	if line.include? "oracle failed"
		oracleErrorArray.push(currentSite)
	end
end
allTestSites.uniq!
failedArray.uniq!
supportFacebookSSO.uniq!
doesNotSupportFacebookSSO.uniq!
dnsErrorArray.uniq!
oracleErrorArray.uniq!
stalledAtAboveTwoPhases.uniq!
vul1.uniq!
vul2.uniq!
vul3.uniq!
vul4.uniq!
vul5.uniq!

dnsErrorArray.each do |s|
	if (failedArray.include? s) then failedArray.delete(s) end
end

stalledAtAboveTwoPhases.each do |s|
	if (!failedArray.include? s) then stalledAtAboveTwoPhases.delete(s) end
end

p "#{allTestSites.length} sites tested in total."
p "A total of #{dnsErrorArray.length} sites failed DNS/initial request"
p "Total valid test cases: #{allTestSites.length - dnsErrorArray.length}"
p "--------------------------------"
p "Saw a total of " + supportFacebookSSO.length.to_s + " sites that support Facebook SSO"
p "Saw a total of " + doesNotSupportFacebookSSO.length.to_s + " sites that doesn't support Facebook SSO"
p "The rest sites stalled at phase 2 or 3, in which case we cannot determine if the site support FB SSO or not."
p "Saw a total of " + vul1.length.to_s + " sites that are vulnerable to [1]"
p "Saw a total of " + vul2.length.to_s + " sites that are vulnerable to [2]"
p "Saw a total of " + vul3.length.to_s + " sites that are vulnerable to [3]"
p "Saw a total of " + vul4.length.to_s + " sites that are vulnerable to [4]"
p "Saw a total of " + vul5.length.to_s + " sites that are vulnerable to [5]"

p "---------------------------------"
p "A total of #{failedArray.length} sites failed"
p "Of these, #{stalledAtAboveTwoPhases.length} sites stalled at >=2 phase, and they are outputed to stalledSites.txt"
p "Of these, #{oracleErrorArray.length} sites failed due to oracle problems"

outputText = "exports.testList = ["

failedArray.each do |site|
	outputText += "'#{site}',"
end

if (ARGV[1]=='include')
	doesNotSupportFacebookSSO.each do |site|
		outputText += "'#{site}',"
	end
	p "All failed sites output to allFailedSites.js, including sites that doesn't support FB."
else
	p "All failed sites output to allFailedSites.js, not including sites that doesn't support FB."
end

outputText = outputText[0..-2] + "];"
File.open("allFailedSites.js","w+"){|f|
	f.write(outputText)
}

oracleErrorArray.each do |s|
	if (failedArray.include? s) then failedArray.delete(s) end
end

stalledAtAboveTwoPhases.each do |s|
	if (failedArray.include? s) then failedArray.delete(s) end
end

outputText = "exports.testList = ["

stalledAtAboveTwoPhases.each do |site|
	outputText += "'#{site}',"
end

outputText = outputText[0..-2] + "];"

File.open("stalledTestList.js","w+"){|f|
	f.write(outputText)
}

outputText = "exports.testList = ["

failedArray.each do |site|
	outputText += "'#{site}',"
end

outputText = outputText[0..-2] + "];"
File.open("debugTestList.js","w+"){|f|
	f.write(outputText)
}
p "The rest #{failedArray.length} sites failed, and they are outputed to debugTestList.js."


