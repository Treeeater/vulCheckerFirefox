if !(ARGV.length == 3 || ARGV.length == 2)
	p "[usage]: ARGV0: input file, ARGV1: output csv file, ARGV2 (optional): output error.js file"
	exit
end

fh = File.open(ARGV[0],"r")
siteURL = ""

class ClickInfo
	attr_accessor :clickAttempts, :clickStrategyAndRank, :stringSig, :score
	def initialize()
	end
end

class StatRecord
	attr_accessor :reg, :clicks
	def initialize()
	end
end

outputCSV = "Site,Reg,Clicks,Score1,VSr1,ISr1,VRr1,IRr1,FB1,Facebook1,OAuth1,login1,signin1,connect1,account1,forum1,Score2,VSr2,ISr2,VRr2,IRr2,FB2,Facebook2,OAuth2,login2,signin2,connect2,account2,forum2\n"
outputErrorSites = Array.new
statRecords = Hash.new
clicks = Array.new
fh.each_line{|l|	
	l.chomp!
	if (l.start_with? "Testing site:") 
		siteURL = l[14..-1]
		reg = "NA"
		clicks = Array.new
		statRecord = StatRecord.new
		statRecords[siteURL] = statRecord
		statRecords[siteURL].clicks = clicks
	end
	if (l.start_with? "USENIX test: reg needed.") then statRecords[siteURL].reg = "true" end
	if (l.start_with? "USENIX test: reg not needed.") then statRecords[siteURL].reg = "false" end
	if (l.start_with? "stats: ")
		clicksRaw = l[7..-1].split('+')
		clicksRaw.each_index{|i|
			clickInfo = ClickInfo.new
			clickInfo.clickAttempts = i
			clickInfo.clickStrategyAndRank = Hash.new
			strategy = clicksRaw[i].split(';')
			strategy.each{|s|
				temp = s.split('/')
				clickInfo.score = temp[1]
				clickInfo.clickStrategyAndRank[temp[0]] = temp[2]
			}
			clicks[i] = clickInfo
		}
		statRecords[siteURL].clicks = clicks
	end
	if (l.start_with? "stringSig: ")
		sigRaw = l[11..-1].split('+')
		sigRaw.each_index{|i|
			if (sigRaw[i].index('undefined')!=nil)
				statRecords[siteURL].clicks[i].stringSig = ['NA','NA','NA','NA','NA','NA','NA','NA']
				next
			end
			if (i >= statRecords[siteURL].clicks.length)
				p "error: no corresponding stringSig info!"
				next
			end
			statRecords[siteURL].clicks[i].stringSig = sigRaw[i].split('|')
		}
	end
}

statRecords.each_key{|k|
	if (!statRecords[k].reg)
		outputCSV += (k + "," + "error\n")
		outputErrorSites.push(k)
		next
	end
	outputCSV += (k + "," + statRecords[k].reg + "," + statRecords[k].clicks.length.to_s)
	temp = ""
	statRecords[k].clicks.each_index{|i|
		temp += ("," + statRecords[k].clicks[i].score)
		for j in 0..3
			if (statRecords[k].clicks[i].clickStrategyAndRank[j.to_s])
				temp += ("," + statRecords[k].clicks[i].clickStrategyAndRank[j.to_s])
			else
				temp += ",-1"
			end
		end
		temp += ("," + statRecords[k].clicks[i].stringSig.join(","))
	}
	outputCSV += temp + "\n"
}

File.open(ARGV[1],"w"){|f| f.write(outputCSV)}
if (ARGV[2]) then File.open(ARGV[2],"w"){|f| f.write("exports.testList = ['#{outputErrorSites.join("','")}'];")} end

