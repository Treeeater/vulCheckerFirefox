fileName = ARGV[0]

text = File.open(fileName).read
currentSite = ""
failedArray = Array.new
supportFacebookSSO = Array.new
vul1 = Array.new
vul2 = Array.new
vul3 = Array.new
vul4 = Array.new
vul5 = Array.new
text.each_line do |line|
	if line.start_with? "Testing site:"
		currentSite = line[14..-1].chomp
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
end
failedArray = failedArray.uniq
supportFacebookSSO = supportFacebookSSO.uniq
vul1 = vul1.uniq
vul2 = vul2.uniq
vul3 = vul3.uniq
vul4 = vul4.uniq
vul5 = vul5.uniq

p "Seen a total of " + supportFacebookSSO.length.to_s + " sites that support Facebook SSO"
p "Seen a total of " + vul1.length.to_s + " sites that are vulnerable to [1]"
p "Seen a total of " + vul2.length.to_s + " sites that are vulnerable to [2]"
p "Seen a total of " + vul3.length.to_s + " sites that are vulnerable to [3]"
p "Seen a total of " + vul4.length.to_s + " sites that are vulnerable to [4]"
p "Seen a total of " + vul5.length.to_s + " sites that are vulnerable to [5]"

outputText = "exports.testList = ["

failedArray.each do |site|
	outputText += "'#{site}',"
end

outputText = outputText[0..-2] + "];"
File.open("failedSites.txt","w+"){|f|
	f.write(outputText)
}

p "Failed sites outputed to failedSites.txt"


