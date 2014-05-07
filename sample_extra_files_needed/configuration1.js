var CONST = require('./const');

exports.debug = true;
exports.writeFlag = true;
exports.automatedTestingFlag = true;
exports.tryFindInvisibleLoginButton = false;
exports.registrationNeeded = false;
exports.searchForSignUpForFB = false;
exports.cleanResultDirectoryUponInit = false;
exports.webService = false;

exports.SubmitButtonClickDepth = 2;
exports.LoginButtonCandidateSize = 32;
exports.SubmitButtonCandidateSize = 2;

exports.USENIX = {experiments: {recordLoginButton: true, testRegistrationNeeded:false, exhaustiveSearchAndRecord:false, searchLoginButtonOnly:true}};

exports.detectionMode = CONST.dm.access_token_vul | CONST.dm.code_vul | CONST.dm.signed_request_vul | CONST.dm.referrer_vul | CONST.dm.secret_in_body_vul;
//auto generated below
//------------------

exports.LoginButtonClickDepth = 2;
exports.maxCandidatesAllowedEachStrategy = 3;
exports.oracleURL = false;
exports.tryUpperRightCorner = true;
exports.mustBeHostRelatedDomain = true;