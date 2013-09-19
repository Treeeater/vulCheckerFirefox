if (ARGV.length != 2)
	p "wrong number of arguments. needs 2"
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
resultFile.each_line{|l|
	site = l.split(',')[0]
	index = rankArray.index(site[11..-1])
	if (index == nil) 
		p l
	else
		rankedArrayToWrite[index] = l
		if (percentileArray[index*100/totalSites] == nil) then percentileArray[index*100/totalSites] = 1 else percentileArray[index*100/totalSites] += 1 end
	end
}

percentileFileContent = ""
rankedFileContent = ""

percentileArray.each{|p|
	percentileFileContent += (p.to_s + ",")
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