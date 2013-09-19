if (ARGV.length != 2)
	p "wrong number of arguments. needs 2, first: quantcast list. second: result.csv"
	exit 
end

rankFile = File.open(ARGV[0],'r')
resultFile = File.open(ARGV[1],'r')

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
resultFile.each_line{|l|
	temp = l.chomp.split(',')
	site = temp[0]
	vul13 = (temp[1] == '-1' || temp[3] == '-1')
	vul45 = (temp[4] == '-1' || temp[5] == '-1')
	index = rankArray.index(site[11..-1])
	if (index == nil) 
		p l
	else
		rankedArrayToWrite[index] = l
		if (percentileArray[index*100/totalSites] == nil) then percentileArray[index*100/totalSites] = 1 else percentileArray[index*100/totalSites] += 1 end
		if vul13
			if (vul13PercentileArray[index*100/totalSites] == nil) then vul13PercentileArray[index*100/totalSites] = 1 else vul13PercentileArray[index*100/totalSites] += 1 end
		end
		if vul45
			if (vul45PercentileArray[index*100/totalSites] == nil) then vul45PercentileArray[index*100/totalSites] = 1 else vul45PercentileArray[index*100/totalSites] += 1 end
		end
	end
}

percentileFileContent = ""
rankedFileContent = ""

percentileArray.each_index{|i|
	if !percentileArray[i] then percentileArray[i] = 0 end
	percentileFileContent += (percentileArray[i].to_s + ",")
}
percentileFileContent += "\n"

vul13PercentileArray.each_index{|i|
	if !vul13PercentileArray[i] then vul13PercentileArray[i] = 0 end
	percentileFileContent += (vul13PercentileArray[i].to_s + ",")
}

percentileFileContent += "\n"

vul45PercentileArray.each_index{|i|
	if !vul45PercentileArray[i] then vul45PercentileArray[i] = 0 end
	percentileFileContent += (vul45PercentileArray[i].to_s + ",")
}

percentileFileContent += "\n"

vul13PercentileArray.each_index{|i|
	if (percentileArray[i] == 0) then percentileFileContent += "0," end
	percentileFileContent += ((vul13PercentileArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n"

vul45PercentileArray.each_index{|i|
	if (percentileArray[i] == 0) then percentileFileContent += "0," end
	percentileFileContent += ((vul45PercentileArray[i]/percentileArray[i].to_f).to_s + ",")
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