require 'fileutils'

i = 0

if (Dir.exists?("gatheredResults")) then FileUtils.rm_rf("./gatheredResults/") end
FileUtils.mkdir_p("./gatheredResults/")

resultContents = ""
while (Dir.exists?("vulCheckerProfile#{i}"))
	if (!Dir.exists?("vulCheckerProfile#{i}/testResults/") || !File.exists?("vulCheckerProfile#{i}/testResults/results.txt"))
		i+=1
		next
	end
	Dir.foreach("vulCheckerProfile#{i}/testResults/") do |item|
		next if item == '.' or item == '..' or item == 'finished.txt' or item == 'results.txt'
		FileUtils.cp "vulCheckerProfile#{i}/testResults/#{item}","./gatheredResults/" 
	end
	resultContents += IO.read("vulCheckerProfile#{i}/testResults/results.txt")
	i+=1
end

File.open("./gatheredResults/results.txt","w"){|f|
	f.write(resultContents)
}