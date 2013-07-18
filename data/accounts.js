var Account = function(fn,ln,email,pic,pic2,pic3,pic4,pass,token){
	this.firstName = fn;
	this.lastName = ln;
	this.email = email;
	this.picSRC = pic;					//there are three pic srcs, and the site could use either.
	this.picSRC2 = pic2;
	this.picSRC3 = pic3;
	this.picSRC4 = pic4;
	this.passwd = pass;
	this.access_token = token;
}

var accounts = [];


//Use all lower case please:
//no http protocol in picsrc please, because sites might use https.

//accounts.push(new Account("yuchentest","zhou","t-yuzhou@hotmail.com","372678_100003929906137_108293698_q.jpg","10468_169575083183487_845810054_n.jpg","graph.facebook.com/yuchentest.zhou/picture","graph.facebook.com/100003929906137/picture","msr123456"));
//accounts.push(new Account("syxvq","ldswpk","syxvq_ldswpk@yahoo.com","211884_100006061110883_1974931350_q.jpg","971984_1374544449424246_1607036321_n.jpg","graph.facebook.com/syxvq.ldswpk/picture","graph.facebook.com/100006061110883/picture","msr123456"));
//accounts.push(new Account("chishi","wochishi","chishiwo@yahoo.com","372654_100006188405019_233762707_q.jpg","969187_1376813269201607_843083776_n.jpg","graph.facebook.com/chishi.wo/picture","graph.facebook.com/100006188405019/picture","msr123456"));
//accounts.push(new Account("oiaeai","cktstltauoai","oiaeaicktstltauoai@yahoo.com","211864_100006154000685_1779045138_q.jpg","1000284_1381272638754523_1690689043_n.jpg","graph.facebook.com/oiaeai.cktstltauoai/picture","graph.facebook.com/100006154000685/picture","msr123456"));



//Unused new accounts.

//accounts.push(new Account("chadadarnya","isackaldon","chadadarnyaisackaldon@outlook.com","623988_100006266226539_974898149_q.jpg","1010316_1377495322469329_736772771_n.jpg","graph.facebook.com/chadadarnya.isackaldon/picture","graph.facebook.com/100006266226539/picture","dis123456"));
//81/1/2
//accounts.push(new Account("jiskamesda","quanarista","jiskamesdaquanarista@hotmail.com","369177_100006276816327_1668581066_q.jpg","1010344_1377140669171814_527772787_n.jpg","graph.facebook.com/jiskamesda.quanarista/picture","graph.facebook.com/100006276816327/picture","lasoei2lx"));

accounts.push(new Account("freachylet","dehoffman","dehoffmanf@hotmail.com","23184_100006403802926_209636439_q.jpg","72630_1376348132588634_1955838392_n.jpg","graph.facebook.com/freachylet.dehoffman/picture","graph.facebook.com/100006403802926/picture","namffohed","CAADxRthhGccBAEvFsHmZBl3uyI3TnZBpTS6k9ipMWNc3s1p5CZCSa52DOpYvMCEsKlqLyAaIU7AvzofVqPsI8WkhZAmx9bKsoDOQE2qZCDKEnu01IIxOj01z9gMxYNVgr7oTCij4qDwqhz1jfG3sG9ZCgZBf9oh4bUZD"));

accounts.push(new Account("peatery","mcgerials","mcgerialsp@hotmail.com","573268_100006389916249_290949439_q.jpg","970121_1379358592287125_147233692_n.jpg","graph.facebook.com/peatery.mcgerials/picture","graph.facebook.com/100006389916249/picture","slairegcm","CAADxRthhGccBANi9kZCzMZC9Aj5a6vlRPsyO0r3ZC8yY9PmWN0AkS79fzjixw2AonxJAy4cZC1E4FDpf9op0M4Phd9Is4ZCfaUMZChbTJu5Xlf2RlGeuVGlrW9QaUzIEVmYSbFI5MiQitiZCgOz3ZB8LJ7FHEbsMChkZD"));

//86/2/6