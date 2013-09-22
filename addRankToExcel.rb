if (ARGV.length != 2)
	p "wrong number of arguments. needs 2, first: quantcast list (original quantcast.txt w/o hidden profile). second: result.csv"
	exit 
end

rankFile = File.open(ARGV[0],'r')
resultFile = File.open(ARGV[1],'r')
Granularity = 100

rankArray = Array.new
totalSites = 0
rankFile.each_line{|l|
	rankArray.push(l.chomp)
	totalSites+=1
}
rankedArrayToWrite = Hash.new
percentileArray = Array.new
vul13PercentileArray = Array.new
vul45PercentileArray = Array.new
vulPercentileArray = Array.new
errorDetectedArray = Array.new
errorArray = Array.new
resultFile.each_line{|l|
	temp = l.chomp.split(',')
	site = temp[0]
	vul13 = (temp[1] == '-1' || temp[3] == '-1')
	vul45 = (temp[4] == '-1' || temp[5] == '-1')
	errorDetected = temp[1] == '2'
	error = ((temp[1] == '10') || errorDetected)
	index = rankArray.index(site[11..-1])
	if (index == nil) 
		p l
	else
		rankedArrayToWrite[index] = l
		if (percentileArray[index*Granularity/totalSites] == nil) then percentileArray[index*Granularity/totalSites] = 1 else percentileArray[index*Granularity/totalSites] += 1 end
		if vul13
			if (vul13PercentileArray[index*Granularity/totalSites] == nil) then vul13PercentileArray[index*Granularity/totalSites] = 1 else vul13PercentileArray[index*Granularity/totalSites] += 1 end
		end
		if vul45
			if (vul45PercentileArray[index*Granularity/totalSites] == nil) then vul45PercentileArray[index*Granularity/totalSites] = 1 else vul45PercentileArray[index*Granularity/totalSites] += 1 end
		end
		if vul45 || vul13
			if (vulPercentileArray[index*Granularity/totalSites] == nil) then vulPercentileArray[index*Granularity/totalSites] = 1 else vulPercentileArray[index*Granularity/totalSites] += 1 end
		end
		if errorDetected
			if (errorDetectedArray[index*Granularity/totalSites] == nil) then errorDetectedArray[index*Granularity/totalSites] = 1 else errorDetectedArray[index*Granularity/totalSites] += 1 end
		end
		if error
			if (errorArray[index*Granularity/totalSites] == nil) then errorArray[index*Granularity/totalSites] = 1 else errorArray[index*Granularity/totalSites] += 1 end
		end
	end
}

percentileFileContent = "# of sites supporting FB SSO,"
rankedFileContent = ""

percentileArray.each_index{|i|
	if !percentileArray[i] then percentileArray[i] = 0 end
	percentileFileContent += (percentileArray[i].to_s + ",")
}

percentileFileContent += "\n% of sites supporting FB SSO,"

percentileArray.each_index{|i|
	if !percentileArray[i] then percentileArray[i] = 0 end
	percentileFileContent += ((percentileArray[i]*Granularity.to_f/totalSites).to_s + ",")
}

percentileFileContent += "\n# of sites vulnerable to simulated attacks,"

vul13PercentileArray.each_index{|i|
	if !vul13PercentileArray[i] then vul13PercentileArray[i] = 0 end
	percentileFileContent += (vul13PercentileArray[i].to_s + ",")
}

percentileFileContent += "\n# of sites leaking credentials,"

vul45PercentileArray.each_index{|i|
	if !vul45PercentileArray[i] then vul45PercentileArray[i] = 0 end
	percentileFileContent += (vul45PercentileArray[i].to_s + ",")
}

percentileFileContent += "\n# of sites are vulnerable in general,"

vulPercentileArray.each_index{|i|
	if !vulPercentileArray[i] then vulPercentileArray[i] = 0 end
	percentileFileContent += (vulPercentileArray[i].to_s + ",")
}

percentileFileContent += "\n% of sites vulnerable to simulated attacks,"

vul13PercentileArray.each_index{|i|
	if (percentileArray[i] == 0) then percentileFileContent += "0," end
	percentileFileContent += ((vul13PercentileArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites leaking credentials,"

vul45PercentileArray.each_index{|i|
	if (percentileArray[i] == 0) then percentileFileContent += "0," end
	percentileFileContent += ((vul45PercentileArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites are vulnerable in general,"

vulPercentileArray.each_index{|i|
	if (percentileArray[i] == 0) then percentileFileContent += "0," end
	percentileFileContent += ((vulPercentileArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites detected to have an erroneous implementation,"

errorDetectedArray.each_index{|i|
	if !errorDetectedArray[i] then errorDetectedArray[i] = 0 end
	if (percentileArray[i] == 0) then percentileFileContent += "0," end
	percentileFileContent += ((errorDetectedArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites having an erroneous implementation,"

errorArray.each_index{|i|
	if !errorArray[i] then errorArray[i] = 0 end
	if (percentileArray[i] == 0) then percentileFileContent += "0," end
	percentileFileContent += ((errorArray[i]/percentileArray[i].to_f).to_s + ",")
}

rankedArrayToWrite.sort.map do |key,value|
	rankedFileContent += key.to_s + "," + value
end

File.open("percentile.csv", "w"){|f|
	f.write(percentileFileContent)
}

File.open("rankedOutput.csv", "w"){|f|
	f.write(rankedFileContent)
}