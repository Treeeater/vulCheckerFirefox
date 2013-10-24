BucketSize = 50
lines = File.open("rankedOutput.csv").read
arr = Array.new
i = 0
lines.each_line{|l|
	arr[i] = l.chomp
	i+=1
}
curLine = 0
cm = Array.new
cl = Array.new
sdkWidget = Array.new
either = Array.new
while (curLine < arr.length)
	line = arr[curLine]
	temp = line.split(',')
	bucket = curLine/BucketSize
	if (temp[2]=='-1'||temp[4]=='-1') 
		if (!cm[bucket]) then cm[bucket] = 1 else cm[bucket] += 1 end
	end
	if (temp[3]=='-1'||temp[5]=='-1'||temp[6]=='-1') 
		if (!cl[bucket]) then cl[bucket] = 1 else cl[bucket] += 1 end
	end
	if (temp[3]=='-1'||temp[5]=='-1'||temp[6]=='-1'||temp[2]=='-1'||temp[4]=='-1') 
		if (!either[bucket]) then either[bucket] = 1 else either[bucket] += 1 end
	end
	if (temp[7]=='1'||temp[8]=='1') 
		if (!sdkWidget[bucket]) then sdkWidget[bucket] = 1 else sdkWidget[bucket] += 1 end
	end
	curLine += 1
end
stringToWrite = "Credential Misuse,"
for i in 0..bucket
	if (cm[i]==nil) then cm[i]=0 end
	stringToWrite += ((cm[i]/BucketSize.to_f).to_s + ",")
end
stringToWrite += "\n"
stringToWrite += "Credential leakage,"
for i in 0..bucket
	if (cl[i]==nil) then cl[i]=0 end
	stringToWrite += ((cl[i]/BucketSize.to_f).to_s + ",")
end
stringToWrite += "\n"
stringToWrite += "Either,"
for i in 0..bucket
	if (either[i]==nil) then either[i]=0 end
	stringToWrite += ((either[i]/BucketSize.to_f).to_s + ",")
end
stringToWrite += "\n"
stringToWrite += "SDK & Widget,"
for i in 0..bucket
	if (sdkWidget[i]==nil) then sdkWidget[i]=0 end
	stringToWrite += ((sdkWidget[i]/BucketSize.to_f).to_s + ",")
end
stringToWrite += "\n"
File.open("facebookBin.csv","w"){|f|
	f.write(stringToWrite)
}