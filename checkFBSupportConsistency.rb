if (ARGV.length != 2)
	p "wrong number of arguments. needs 2"
	exit 
end

fileName1 = ARGV[0]
fileName2 = ARGV[1]

text1 = File.open(fileName1).read
text2 = File.open(fileName2).read
needsSupportFacebookSSO1 = Array.new
supportFacebookSSO2 = Array.new
allSites2 = Array.new

text1.each_line do |line|
	if (line.start_with? "Site URL") then next end			#skip CSV header
	tempArray = line.split(',')
	siteURL = tempArray[0]
	if (tempArray[1].empty? || tempArray[2].empty? || tempArray[3].empty? || tempArray[4].empty? || tempArray[5].empty?)
		needsSupportFacebookSSO1.push(siteURL)
	end
end

currentSite = ""

text2.each_line do |line|
	if line.start_with? "Testing site:"
		currentSite = line[14..-1].chomp
		allSites2.push(currentSite)
	end
	if line.include? "vulnerable"
		supportFacebookSSO2.push(currentSite)
	end
end

needsSupportFacebookSSO1.uniq!
supportFacebookSSO2.uniq!
allSites2.uniq!

p allSites2.length
i = 0
needsSupportFacebookSSO1.each{|site|
	if (!allSites2.include? site) 
		i+=1
		p site
	end
}

p i