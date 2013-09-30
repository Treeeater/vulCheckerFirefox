if (ARGV.length < 2 || ARGV.length > 4)
	p "wrong number of arguments. needs 2 or 3, first: quantcast list (original quantcast.txt w/o hidden profile). second: result.csv. Third(optional): folder name where all detailed results are stored, this is used for collecting stats about widget and SDK usage."
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
sDKUseArray = Array.new
widgetArray = Array.new
sDKVul13 = 0
sDKVul45 = 0
widgetVul13 = 0
widgetVul45 = 0
totalVul13 = 0
totalVul45 = 0
totalVul = 0
totalSDK = 0
totalWidget = 0
resultFile.each_line{|l|
	if (l[0..7] == 'Site URL') then next end		#skip form header
	temp = l.chomp.split(',')
	site = temp[0]
	vul13 = (temp[1] == '-1' || temp[3] == '-1')
	vul45 = (temp[4] == '-1' || temp[5] == '-1')
	errorDetected = temp[1] == '2'
	error = ((temp[1] == '10') || errorDetected)
	index = rankArray.index(site[11..-1])
	if (index == nil) 
		p l + " doesn't have ranking information??"
	else
		bucket = index*Granularity/totalSites
		if (percentileArray[bucket] == nil) then percentileArray[bucket] = 1 else percentileArray[bucket] += 1 end
		if vul13
			totalVul13 += 1
			if (vul13PercentileArray[bucket] == nil) then vul13PercentileArray[bucket] = 1 else vul13PercentileArray[bucket] += 1 end
		end
		if vul45
			totalVul45 += 1
			if (vul45PercentileArray[bucket] == nil) then vul45PercentileArray[bucket] = 1 else vul45PercentileArray[bucket] += 1 end
		end
		if vul45 || vul13
			totalVul += 1
			if (vulPercentileArray[bucket] == nil) then vulPercentileArray[bucket] = 1 else vulPercentileArray[bucket] += 1 end
		end
		if errorDetected
			if (errorDetectedArray[bucket] == nil) then errorDetectedArray[bucket] = 1 else errorDetectedArray[bucket] += 1 end
		end
		if error
			if (errorArray[bucket] == nil) then errorArray[bucket] = 1 else errorArray[bucket] += 1 end
		end
		if (ARGV[2])
			fileName = ARGV[2]+"/"+site.gsub(/[^a-zA-Z0-9]*/,"")[0..31]+".txt"
			l.chomp!
			if (!File.exists?(fileName))
				p site + " doesn't have a detailed corresponding file?"
				l += ",0,0,0\n"
			else
				detailedContent = File.read(fileName)
				if (detailedContent.include? "This site uses FB SDK")
					if (sDKUseArray[bucket] == nil) then sDKUseArray[bucket] = 1 else sDKUseArray[bucket] += 1 end
					if (vul13) then sDKVul13+=1 end
					if (vul45) then sDKVul45+=1 end
					totalSDK+=1
					l += ",1"
				else
					l += ",0"
				end
				if (detailedContent.include? "Site uses social plugin button.php")
					if (widgetArray[bucket] == nil) then widgetArray[bucket] = 1 else widgetArray[bucket] += 1 end
					if (vul13) then widgetVul13+=1 end
					if (vul45) then widgetVul45+=1 end
					totalWidget+=1
					l += ",1\n"
				else
					l += ",0\n"
				end
			end
		end
		rankedArrayToWrite[index] = l
	end
}

# Screen output

p "Total sites: #{rankedArrayToWrite.length}"
p "# of sites vul to 13: #{totalVul13}"
p "% of sites vul to 13: #{totalVul13/rankedArrayToWrite.length.to_f}"
p "# of sites vul to 45: #{totalVul45}"
p "% of sites vul to 45: #{totalVul45/rankedArrayToWrite.length.to_f}"
p "# of sites vul: #{totalVul}"
p "% of sites vul: #{totalVul/rankedArrayToWrite.length.to_f}"
p "Total sites using SDK: #{totalSDK}"
p "Total sites using widget: #{totalWidget}"
p "% of sites vul to 13 using SDK: #{sDKVul13/totalSDK.to_f}"
p "% of sites vul to 45 using SDK: #{sDKVul45/totalSDK.to_f}"
p "% of sites vul to 13 using widget: #{widgetVul13/totalWidget.to_f}"
p "% of sites vul to 45 using widget: #{widgetVul45/totalWidget.to_f}"

#


percentileFileContent = "# of sites supporting FB SSO,"
rankedFileContent = "Rank,Site URL,token vul,secret vul,signed_request vul,referrer vul,DOM vul\n"
if (ARGV[2]) then rankedFileContent = "Rank,Site URL,token vul,secret vul,signed_request vul,referrer vul,DOM vul, SDK used, social plugin used\n" end
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
	if (percentileArray[i] == 0) 
		percentileFileContent += "0,"
		next
	end
	percentileFileContent += ((vul13PercentileArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites leaking credentials,"

vul45PercentileArray.each_index{|i|
	if (percentileArray[i] == 0)
		percentileFileContent += "0,"
		next
	end
	percentileFileContent += ((vul45PercentileArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites are vulnerable in general,"

vulPercentileArray.each_index{|i|
	if (percentileArray[i] == 0)
		percentileFileContent += "0,"
		next
	end
	percentileFileContent += ((vulPercentileArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites use Facebook SDK,"

sDKUseArray.each_index{|i|
	if !sDKUseArray[i] then sDKUseArray[i] = 0 end
	if (percentileArray[i] == 0)
		percentileFileContent += "0,"
		next
	end
	percentileFileContent += ((sDKUseArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites use Facebook social widget,"

widgetArray.each_index{|i|
	if !widgetArray[i] then widgetArray[i] = 0 end
	if (percentileArray[i] == 0) 
		percentileFileContent += "0,"
		next
	end
	percentileFileContent += ((widgetArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites detected to have an erroneous implementation,"

errorDetectedArray.each_index{|i|
	if !errorDetectedArray[i] then errorDetectedArray[i] = 0 end
	if (percentileArray[i] == 0) 
		percentileFileContent += "0," 
		next
	end
	percentileFileContent += ((errorDetectedArray[i]/percentileArray[i].to_f).to_s + ",")
}

percentileFileContent += "\n% of sites having an erroneous implementation,"

errorArray.each_index{|i|
	if !errorArray[i] then errorArray[i] = 0 end
	if (percentileArray[i] == 0) 
		percentileFileContent += "0," 
		next
	end
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