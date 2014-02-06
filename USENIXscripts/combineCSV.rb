if (ARGV.length!=3)
	p "ARGV0: old input csv, ARGV1: newly created input csv, ARGV2: output csv"
	exit
end

a = File.read(ARGV[0]).split("\n")
b = File.read(ARGV[1]).split("\n")

outputText = ""
a.each{|al|
	if (al.index("error")!=nil)
		matched = false
		b.each{|bl|
			if bl.start_with?(al.split(",")[0])
				outputText += "#{bl}\n"
				matched = true
				break
			end
		}
		if (!matched) then outputText += "#{al}\n" end
	else
		outputText += "#{al}\n"
	end
}

File.open(ARGV[2],"w"){|f| f.write(outputText)}