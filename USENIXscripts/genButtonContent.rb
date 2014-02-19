if !(ARGV.length == 2)
	p "[usage]: ARGV0: input result file, ARGV1: output csv"
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
		key = "#{url}#{xPath}#{outerHTML}#{c_i+1}"
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
fB = [0, 0]
facebook = [0, 0]
logion = [0, 0]
signion = [0, 0]
connect = [0, 0]
oauth = [0, 0]
account = [0, 0]
forum = [0, 0]
statRecords.each_value{|sr|
	sr.each_value{|r|
		if (r.clickNo != 2) then next end			#if i want to get info for a particular click
		fB[(r.success ? 0:1)] += r.stringSig[0].to_i
		facebook[(r.success ? 0:1)] += r.stringSig[1].to_i
		logion[(r.success ? 0:1)] += r.stringSig[2].to_i
		signion[(r.success ? 0:1)] += r.stringSig[3].to_i
		connect[(r.success ? 0:1)] += r.stringSig[4].to_i
		oauth[(r.success ? 0:1)] += r.stringSig[5].to_i
		account[(r.success ? 0:1)] += r.stringSig[6].to_i
		forum[(r.success ? 0:1)] += r.stringSig[7].to_i
	}
}

output = "FB, Facebook, logion, signion, connect, oauth, account, forum\n"
output += "#{fB[0]},#{facebook[0]},#{logion[0]},#{signion[0]},#{connect[0]},#{oauth[0]},#{account[0]},#{forum[0]}\n"
output += "#{fB[1]},#{facebook[1]},#{logion[1]},#{signion[1]},#{connect[1]},#{oauth[1]},#{account[1]},#{forum[1]}\n"
output += "#{fB[0].to_f/(fB[1]+fB[0])},#{facebook[0].to_f/(facebook[1]+facebook[0])},#{logion[0].to_f/(logion[1]+logion[0])},#{signion[0].to_f/(signion[1]+signion[0])},#{connect[0].to_f/(connect[1]+connect[0])},#{oauth[0].to_f/(oauth[1]+oauth[0])},#{account[0].to_f/(account[1]+account[0])},#{forum[0].to_f/(forum[1]+forum[0])}\n"

File.open(ARGV[1],"w"){|f| f.write(output)}
