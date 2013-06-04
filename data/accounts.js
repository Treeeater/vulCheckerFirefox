var Account = function(fn,ln,email,pic,pic2,pic3){
	this.firstName = fn;
	this.lastName = ln;
	this.email = email;
	this.picSRC = pic;					//there are three pic srcs, and the site could use either.
	this.picSRC2 = pic2;
	this.picSRC3 = pic3;
}

var accounts = [];

accounts.push(new Account("Yuchentest","Zhou","t-yuzhou@hotmail.com","372678_100003929906137_108293698_q.jpg","10468_169575083183487_845810054_n.jpg","http://graph.facebook.com/yuchentest.zhou/picture"));

accounts.push(new Account("Syxvq","Ldswpk","Syxvq_Ldswpk@yahoo.com","211884_100006061110883_1974931350_q.jpg","971984_1374544449424246_1607036321_n.jpg","http://graph.facebook.com/syxvq.ldswpk/picture"));

//TODO: Some sites may put user's FBID as some node's attr, to detect this we need to look at the response, not the extracted Content.