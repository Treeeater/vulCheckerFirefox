temp = IO.readlines("quantcast-top-10000.txt")
sitesToTest = Array.new
temp.each{|t|
	t="http://www."+t
	sitesToTest.push(t.chomp)
}
i = 0
j = 0
totalFileNumber = sitesToTest.length/500+1
if (!Dir.exists? "dataset")
	Dir.mkdir "dataset"
end
for i in 0..totalFileNumber-2
	File.open("dataset\\testSet"+(i+1).to_s+".js","w"){|fh|
		fh.write("//This test set includes site No. #{i*500} to #{i*500+499}.\n")
		fh.write("exports.testList = [")
		for j in 0..498
			fh.write("'"+sitesToTest[i*500+j]+"',")
		end
		fh.write("'#{sitesToTest[i*500+499]}'];")
	}
end
File.open("dataset\\testSet"+(i+2).to_s+".js","w"){|fh|
	fh.write("//This test set includes site No. #{(i+1)*500} to #{(i+1)*500+sitesToTest.length%500}.\n")
	fh.write("exports.testList = [")
	for j in 0..sitesToTest.length%500-2
		fh.write("'"+sitesToTest[(i+1)*500+j]+"',")
	end
	fh.write("'#{sitesToTest[(i+1)*500+j+1]}'];")
}