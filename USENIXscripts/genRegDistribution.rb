rankFH = File.open("quantcast-top-20k.txt","r")

rankHash = Hash.new

i = 1
rankFH.each_line{|l|
	rankHash["#{l.chomp}"] = i
	i+=1
}

regFH = File.open("output_exclude_nofb.csv","r")

bucketSize = 200
bucket = Array.new
bucketReg = Array.new
regFH.each_line{|l|
	temp = l.split(',')
	site = temp[0]
	if (!rankHash.has_key? site)
		p site
		next
	end
	if (temp[1] == "error") then next end
	if (bucket[rankHash[site]/bucketSize] == nil) then bucket[rankHash[site]/bucketSize] = 0 end
	if (bucketReg[rankHash[site]/bucketSize] == nil) then bucketReg[rankHash[site]/bucketSize] = 0 end
	bucket[rankHash[site]/bucketSize]+=1
	if (temp[1] == "TRUE") then bucketReg[rankHash[site]/bucketSize]+=1 end
}

result = bucketReg.map.with_index{|b, i|
	if (bucket[i] == 0 || bucket[i] == nil)
		0
	else
		b/bucket[i].to_f
	end
}

p "OVERALL: #{(bucketReg.each.reduce(:+))/(bucket.each.reduce(:+).to_f)}"

File.open("regVsRank.csv","w"){|f| f.write(result.join(","))}