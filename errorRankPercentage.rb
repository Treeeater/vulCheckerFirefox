BucketSize = 200

if (ARGV.length != 1)
	p "wrong number of arguments. needs 1"
	exit 
end

inputFileName1 = ARGV[0]
hash = Hash.new
errorHash = Hash.new
text1 = File.readlines(inputFileName1)
errorArray = Array.new
totalArray = Array.new
text1.each do |line|
	if (line.start_with? "Rank") then next end			#skip CSV header
	tempArray = line.split(',')
=begin
	siteURL = tempArray[0]
	if (hash[siteURL]==nil) then hash[siteURL] = Array.new end
	(hash[siteURL])[0] = tempArray[1]
	(hash[siteURL])[1] = tempArray[2]
	(hash[siteURL])[2] = tempArray[3]
	(hash[siteURL])[3] = tempArray[4]
	(hash[siteURL])[4] = tempArray[5]
	(hash[siteURL])[5] = tempArray[6].chomp
=end
	if (errorArray[tempArray[0].to_i/BucketSize] == nil) then errorArray[tempArray[0].to_i/BucketSize] = 0 end
	if (totalArray[tempArray[0].to_i/BucketSize] == nil) then totalArray[tempArray[0].to_i/BucketSize] = 0 end
	if (tempArray[2] == "16" || tempArray[2] == "11" || tempArray[2] == "12" || tempArray[2] == "13" || tempArray[2] == "15" || tempArray[2] == "20" || tempArray[2] == "21" || tempArray[2] == "22" || tempArray[2] == "23" || tempArray[2] == "24")
		errorArray[tempArray[0].to_i/BucketSize] += 1
	end
	totalArray[tempArray[0].to_i/BucketSize] += 1
end

percentageArray = Array.new
errorArray.each_index{|i|
	if (errorArray[i] == nil)
		percentageArray[i] = 0.0
	elsif (totalArray[i] == 0)
		percentageArray[i] = 0.0
	else
		percentageArray[i] = errorArray[i].to_f/totalArray[i]
	end
}

File.open("errorStat.csv","w+"){|f|
	f.write(percentageArray.join(","))
}

