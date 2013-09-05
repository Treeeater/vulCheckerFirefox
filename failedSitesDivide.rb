if (ARGV.length != 2)
	p "wrong number of arguments. needs 2"
	exit 
end

failedSiteFileName = ARGV[0]
numberOfSlices = ARGV[1].to_i

temp = IO.readlines(ARGV[0])
rawSites = temp[0]

rawSites = rawSites[21..-4]

allSites = rawSites.split("','")
p allSites

groupSize = allSites.length/numberOfSlices
stringToWrite = Array.new

for i in 0..numberOfSlices-1
	stringToWrite[i] = "exports.testList = ['"
	for j in 0..groupSize - 2
		stringToWrite[i] = stringToWrite[i] + allSites[i*groupSize+j] + "','"
	end
	if (i != numberOfSlices - 1 || allSites.length % numberOfSlices == 0)
		stringToWrite[i] = stringToWrite[i] + allSites[i*groupSize+j+1] + "'];"
	else
		if (i == numberOfSlices -1)
			stringToWrite[i] = stringToWrite[i] + allSites[i*groupSize+j+1] + "','"
		end
		if (allSites.length % numberOfSlices > 1)
			for k in 0..((allSites.length % numberOfSlices) - 2)
				stringToWrite[i] = stringToWrite[i] + allSites[i*groupSize + groupSize + k] + "','"
			end
			stringToWrite[i] = stringToWrite[i] + allSites[-1] + "'];"
		else
			stringToWrite[i] = stringToWrite[i] + allSites[-1] + "'];"
		end
	end
end

for i in 0..numberOfSlices-1
	File.open("failedSites"+i.to_s+".js",'w'){|f|
		f.write(stringToWrite[i])
	}
end