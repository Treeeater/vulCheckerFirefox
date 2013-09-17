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

stringToWrite = "exports.testList = [['" + allSites[0]

for i in 0..numberOfSlices-1
	for j in 1..groupSize - 1
		stringToWrite = stringToWrite + "','" + allSites[i*groupSize+j]
	end
	if (i != numberOfSlices - 1)
		stringToWrite = stringToWrite + "'],['" + allSites[i*groupSize+j+1]
	else
		while (allSites[i*groupSize+j+1]!=nil)
			stringToWrite = stringToWrite + "','" + allSites[i*groupSize+j+1]
			j+=1
		end
	end
end
stringToWrite += "']];" 
File.open("testSite.js",'w'){|f|
	f.write(stringToWrite)
}