# input1: all 20k sites,  input2: all detected FB sites

SampleSize = 500

allSiteFileName = ARGV[0] || "quantcast-top-20k.txt"
allFBSiteFileName = ARGV[1] || "1660Sites.txt"

allSites = File.read(allSiteFileName).split("\n")
allFBSites = File.read(allFBSiteFileName).split("\n")
outputSites = Array.new

i = 0

while (i < SampleSize)
	temp = allSites[rand(allSites.length)]
	if (!allFBSites.include? temp)
		outputSites.push(temp)
		i+=1
	end
end

File.open("randomSampledNonFBSites.js","w"){|f| 
	f.write("exports.testList = ['")
	f.write(outputSites.join("','"))
	f.write("'];")
}