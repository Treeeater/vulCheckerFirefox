if (ARGV.length != 1)
	p "wrong number of arguments. needs 1"
	exit 
end

inputFileName = ARGV[0]
hash = Hash.new

text = File.open(inputFileName).read

text.each_line do |line|
	if line.match(/(.*?)\sis\snot\svulnerable\sto\s\[(\d)\].*?\n/)
		if (hash[$1]==nil) then hash[$1] = Array.new end
		(hash[$1])[$2.to_i-1] = 1
	end
	if line.match(/(.*?)\sis\svulnerable\sto\s\[(\d)\].*?\n/)
		if (hash[$1]==nil) then hash[$1] = Array.new end
		(hash[$1])[$2.to_i-1] = -1
	end
end

outputText = "Site URL,token vul,secret vul,signed_request vul,referrer vul,DOM vul\n"
completedCases = 0
hash.each_key{|k|
	if (hash[k][0].to_s!="" && hash[k][1].to_s!="" && hash[k][2].to_s!="" && hash[k][3].to_s!="" && hash[k][4].to_s!="") then completedCases+=1 end
	outputText = outputText + k + ',' + hash[k][0].to_s + ',' + hash[k][1].to_s + ',' + hash[k][2].to_s + ',' + hash[k][3].to_s + ',' + hash[k][4].to_s + "\n"
}
p "total completed tests: #{completedCases}"
File.open("Results.csv","w+"){|f|
	f.write(outputText)
}


