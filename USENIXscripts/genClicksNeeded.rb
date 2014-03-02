if !(ARGV.length == 2 || ARGV.length == 1)
	p "[usage]: ARGV0: input result file, ARGV1: output csv (optional)"
	exit
end

fh = File.open(ARGV[0],"r")
siteURL = ""

class ClickInfo
	attr_accessor :site, :success, :clickNo, :O_rank, :minClicksNeeded, :fromIframe, :visible, :w, :h, :type, :x, :y, :stringSig, :score, :clickStrategyAndRank, :xPath, :outerHTML, :clickURL, :futile
	def initialize()
		@minClicksNeeded = 999
		@futile = false
	end
end

statRecords = Hash.new
clicks = Array.new
siteURL = ""
fh.each_line{|l|
	l.chomp!
	success = false
	futile = false
	ignore = true
	if (l.start_with? "Testing site:") 
		siteURL = l[14..-1]
		clicks = Hash.new
		statRecords[siteURL] = clicks
		next
	end
	if (l.start_with? "Succeeded:")
		success = true
		l = l[10..-1]
		ignore = false
	elsif (l.start_with? "Failed:")
		success = false
		l = l[7..-1]
		ignore = false
	end
	if (ignore) then next end
	if (l[-7..-1]=="futile,")
		futile = true 
	end
	if (siteURL == "") then next end
	clicks = l.split(';')
	clicks.each_index{|c_i|
		items = clicks[c_i].split(",")
		if (items.length == 1)
			#this means dup or futile, ignore
			next
		end
		xPath = items[-3]
		outerHTML = items[-2]
		url = items[-1]
		key = "#{url}#{xPath}#{outerHTML}#{c_i}"
		if (statRecords[siteURL][key] == nil) then statRecords[siteURL][key] = ClickInfo.new end
		statRecords[siteURL][key].w = items[-8]
		statRecords[siteURL][key].h = items[-7]
		statRecords[siteURL][key].type = items[-6]
		statRecords[siteURL][key].x = items[-5]
		statRecords[siteURL][key].y = items[-4]
		statRecords[siteURL][key].clickURL = url
		statRecords[siteURL][key].xPath = xPath
		statRecords[siteURL][key].outerHTML = outerHTML
		statRecords[siteURL][key].site = siteURL
		statRecords[siteURL][key].success = statRecords[siteURL][key].success || success
		statRecords[siteURL][key].clickNo = c_i+1
		statRecords[siteURL][key].O_rank = items[0]
		if (statRecords[siteURL][key].minClicksNeeded > clicks.length && success)
			statRecords[siteURL][key].minClicksNeeded = clicks.length
		end
		statRecords[siteURL][key].fromIframe = items[1]
		statRecords[siteURL][key].visible = items[2]
		statRecords[siteURL][key].stringSig = items[3].split("|")
		statRecords[siteURL][key].score = items[4]
		statRecords[siteURL][key].clickStrategyAndRank = Array.new
		if (items.length > 10) then statRecords[siteURL][key].clickStrategyAndRank[items[5].split("/")[0].to_i] = items[5].split("/")[1] end
		if (items.length > 11) then statRecords[siteURL][key].clickStrategyAndRank[items[6].split("/")[0].to_i] = items[6].split("/")[1] end
		if (items.length > 12) then statRecords[siteURL][key].clickStrategyAndRank[items[7].split("/")[0].to_i] = items[7].split("/")[1] end
		if (items.length > 13) then statRecords[siteURL][key].clickStrategyAndRank[items[8].split("/")[0].to_i] = items[8].split("/")[1] end
		if (c_i == clicks.length - 2)
			#last click could be futile, previous must not be.
			statRecords[siteURL][key].futile = futile
		end
	}
}

statRecordsClicksNeeded = Hash.new
oneClickNeeded = 0
twoClicksNeeded = 0
successfulClickNumber = [0,0,0]
clickNumber = [0,0,0]
maxClickSeenOneSite = -1
statRecords.each_key{|url|
	clicksSeenOnThisURL = 0
	if (statRecordsClicksNeeded[url] == nil) then statRecordsClicksNeeded[url] = 999 end
	statRecords[url].each_value{|r|
		if (r.minClicksNeeded < statRecordsClicksNeeded[url])
			statRecordsClicksNeeded[url] = r.minClicksNeeded
		end
		if (r.clickNo != 1 && r.clickNo != 2)
			next
		end
		if (r.success) then successfulClickNumber[r.clickNo] += 1 end
		clickNumber[r.clickNo] += 1
		clicksSeenOnThisURL += 1
	}
	if (maxClickSeenOneSite < clicksSeenOnThisURL) then maxClickSeenOneSite = clicksSeenOnThisURL end
	if (statRecordsClicksNeeded[url] == 1)
		oneClickNeeded += 1
	elsif (statRecordsClicksNeeded[url] == 2)
		twoClicksNeeded += 1
	else 
		p "Error: " + url
	end
}

output = "URL,clicksNeeded\n" + statRecordsClicksNeeded.flatten.each.inject(""){|product, a|
	if (a.to_s =~ /^\d*$/) then product+a.to_s+"\n" else product+a.to_s+"," end
}

p "requiring one clicks:" + oneClickNeeded.to_s
p "requiring two clicks:" + twoClicksNeeded.to_s
p "maximum unique clicks attempted on one site: " + maxClickSeenOneSite.to_s
p successfulClickNumber[1]
p clickNumber[1]
p successfulClickNumber[2]
p clickNumber[2]
if (ARGV[1]!=nil) then File.open(ARGV[1],"w"){|f| f.write(output)} end
