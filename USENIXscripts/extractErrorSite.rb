if (ARGV.length != 2)
	p "ARGV0: input csv.  ARGV1: output js"
	exit
end

records = IO.read(ARGV[0]).split("\n")
outputArr = []
records.each{|r|
	t = r.split(',')
	if (t[1] == 'error') then outputArr.push(t[0]) end
}
File.open(ARGV[1],"w"){|f| f.write("exports.testList = ['#{outputArr.join("','")}'];")}
