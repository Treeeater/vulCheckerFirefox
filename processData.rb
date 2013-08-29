fileName = ARGV[0]

text = File.open(fileName).read
currentSite = ""
failedArray = Array.new
dnsErrorArrayTemp = Array.new
dnsErrorArray = Array.new
oracleErrorArray = Array.new
supportFacebookSSO = Array.new
stalledAtOtherPhases = Array.new
vul1 = Array.new
vul2 = Array.new
vul3 = Array.new
vul4 = Array.new
vul5 = Array.new
totalSites = 0
text.each_line do |line|
	if line.start_with? "Testing site:"
		currentSite = line[14..-1].chomp
		totalSites+=1
	end
	if line.include? "vulnerable"
		supportFacebookSSO.push(currentSite)
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
	if (line.include?("Test stalled at Phase 0") && !dnsErrorArrayTemp.include?(currentSite))
		dnsErrorArrayTemp.push(currentSite)
		next
	end
	if ((line.include? "Test stalled at Phase 0") && (dnsErrorArrayTemp.include? currentSite))
		dnsErrorArray.push(currentSite)
		next
	end
	if (line.include? "Test stalled at Phase ")
		stalledAtOtherPhases.push(currentSite)
	end
	if line.include? "oracle failed"
		oracleErrorArray.push(currentSite)
	end
end
failedArray.uniq!
supportFacebookSSO.uniq!
dnsErrorArray.uniq!
oracleErrorArray.uniq!
stalledAtOtherPhases.uniq!
vul1.uniq!
vul2.uniq!
vul3.uniq!
vul4.uniq!
vul5.uniq!

stalledAtOtherPhases.each do |s|
	if (!failedArray.include? s) then stalledAtOtherPhases.delete(s) end
end

p "#{totalSites} sites tested in total."
p "Saw a total of " + supportFacebookSSO.length.to_s + " sites that support Facebook SSO"
p "Saw a total of " + vul1.length.to_s + " sites that are vulnerable to [1]"
p "Saw a total of " + vul2.length.to_s + " sites that are vulnerable to [2]"
p "Saw a total of " + vul3.length.to_s + " sites that are vulnerable to [3]"
p "Saw a total of " + vul4.length.to_s + " sites that are vulnerable to [4]"
p "Saw a total of " + vul5.length.to_s + " sites that are vulnerable to [5]"
p "A total of #{oracleErrorArray.length} sites failed oracle"
p "A total of #{dnsErrorArray.length} sites failed DNS"

dnsErrorArray.each do |s|
	if (failedArray.include? s) then failedArray.delete(s) end
end

oracleErrorArray.each do |s|
	if (failedArray.include? s) then failedArray.delete(s) end
end

stalledAtOtherPhases.each do |s|
	if (failedArray.include? s) then failedArray.delete(s) end
end

outputText = "exports.testList = ["

failedArray.each do |site|
	outputText += "'#{site}',"
end

outputText = outputText[0..-2] + "];"
File.open("debugTestList.js","w+"){|f|
	f.write(outputText)
}

outputText = "exports.testList = ["

stalledAtOtherPhases.each do |site|
	outputText += "'#{site}',"
end

outputText = outputText[0..-2] + "];"
File.open("stalledTestList.js","w+"){|f|
	f.write(outputText)
}

p "A total number of #{stalledAtOtherPhases.length} sites stalled at none 0 phase, and they are outputed to stalledSites.txt"
p "A total number of #{failedArray.length} sites failed, and they are outputed to failedSites.txt"


