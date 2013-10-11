// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function check_and_redo_credentials_wrapper(e){
	self.port.emit("panelActions", "check_and_redo_credentials");
}

function clickLoginButton_wrapper(e){
	self.port.emit("panelActions", "clickLoginButton");
}

function automateSSO_wrapper(e){
	self.port.emit("panelActions", "automateSSO");
}

function finishRegistration_wrapper(e){
	self.port.emit("panelActions", "finishRegistration");
}

function deleteCookies_wrapper(e){
	self.port.emit("panelActions", "deleteCookies");
}

function testSuiteStart_wrapper(e){
	self.port.emit("panelActions", "testSuiteStart");
}

function reload_extension(e){
	self.port.emit("panelActions", "reload_extension");
}

document.getElementById('refresh').addEventListener('click',check_and_redo_credentials_wrapper);
document.getElementById('clickLogin').addEventListener('click',clickLoginButton_wrapper);
document.getElementById('gothroughsso').addEventListener('click',automateSSO_wrapper);
document.getElementById('finishRegistration').addEventListener('click',finishRegistration_wrapper);
document.getElementById('deleteCookies').addEventListener('click',deleteCookies_wrapper);
document.getElementById('testSuite').addEventListener('click',testSuiteStart_wrapper);
document.getElementById('reload').addEventListener('click',reload_extension);
