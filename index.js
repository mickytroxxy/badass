var app     =     require("express")();
var mysql   =     require("mysql");
var http    =     require('http').Server(app);
var io      =     require("socket.io")(http);
var globalSocket='';
var fs = require('fs'); 
var mkdirp = require('mkdirp');
var upload = require("express-fileupload");
app.use(upload());
app.use('/files',require("express").static(__dirname + '/files'));
var connectedUsers = {};
var listeningArray=[];
var pool    =    mysql.createPool({
  connectionLimit   :   100,
  host              :   'xtrabraindb.cdeosiunsuwv.us-east-2.rds.amazonaws.com',
  port              :   3306,
  user              :   'mickytroxxy',
  password          :   '7624TROXXy!',
  database          :   'xtrabrainDb',
  debug             :   false,
  multipleStatements : true
});
var srv = http.listen(process.env.PORT || 8080, function() {
  console.log("Listening on port 8080");
  pool.getConnection(function(err,connection){  
    if (!!err) {
      console.log("database Access Denied");
    }else{
      connection.release();
      console.log("database Access granted");
    }
  });
  mkdirp('./files/media', function (err) {
   if (err) console.error(err)
   else console.log('directory videos was created')
  });
  
});
app.post("/",function(req,res){
  if (req.files) {
    console.log(req.files)
    var file=req.files.fileUrl;
    var filePath=req.body.filePath;
    var workTopic=req.body.workTopic;
    var workNotes=req.body.workNotes;
    var user=req.body.user;
    var level=req.body.level;
    var uploadTime=req.body.uploadTime;
    var subject=req.body.subject;
    var scheduled=req.body.scheduled;
    file.mv("./"+filePath,function(err){
      if (err) {
        console.log(err);
      }else{
        console.log("file was uploaded 100%");
        insertWork(filePath,workTopic,workNotes,user,level,uploadTime,subject,scheduled);
      }
    });
  }
});
function insertWork(filePath,workTopic,workNotes,user,level,uploadTime,subject,scheduled){
  pool.getConnection(function(err,connection){  
    if (!err) {
      connection.query('SELECT * FROM work WHERE filePath=? AND uploadTime=?',[filePath,uploadTime],function(error,result){
        if (!error) {
          if (result.length==0) {
            connection.query('INSERT INTO work SET ?', {filePath:filePath, workTopic:workTopic, workNotes:workNotes, user:user, level:level, uploadTime:uploadTime, subject:subject, scheduled:scheduled, duration:'', maxReading:''}, function (err, results, fields) {
              if (!err) {
                console.log("New work has been added");
                connection.release();
                getMyWork(user);
                //io.sockets.emit('workResponse',user,filePath,workTopic,workNotes)
              }else{
                console.log(err)
              }
            });
          }
        }
      });
    }
  });
}
function getMyWork(user){
  pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM work WHERE user=?',[user],function(error,result){
          if (!error) {
            if (result.length>0) {
              for (var i = 0; i < result.length; i++){
                var filePath=result[i].filePath;
                var workTopic=result[i].workTopic;
                var workNotes=result[i].workNotes;
                var user=result[i].user;
                var level=result[i].level;
                var uploadTime=result[i].uploadTime;
                var subject=result[i].subject;
                var scheduled=result[i].scheduled;
                var workId=result[i].id;
                io.sockets.emit('get-my-work', filePath,workTopic,workNotes,user,level,uploadTime,subject,scheduled,workId)
              }
            }
            connection.release();
          }
        });
      }
    });
}
app.get("/",function(req,res){
  res.sendFile(__dirname+"/index.html");
})
io.sockets.on('connection', function (socket) {
  console.log('A user has connected wow !')
  socket.on('login', function(school_reg_id,username,password,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM school_details WHERE school_reg_id=?',[school_reg_id],function(error,result){
          if (!error) {
            if (result.length>0) {
              console.log(school_reg_id+' ............................................................... is there '+username+'-'+password)
              connection.query('SELECT * FROM users WHERE username=? AND password=?',[username,password],function(error,result){
                if (!error) {
                  if (result.length>0) {
                    for (var i = 0; i < result.length; i++){
                      var position=result[i].position;
                      var fname=result[i].fname;
                      var grade=result[i].grade;
                      var user_reg_id=result[i].user_reg_id;
                      var username=result[i].username;
                      var assignedSubject=result[i].assignedSubject;
                      console.log('The fname is .................. '+fname)
                      socket.emit('loginSuccess',position,fname,grade,user_reg_id,username,password,school_reg_id,assignedSubject);
                    }
                  }
                }else{
                  cb(4)
                }
                connection.release();
              });
            }else{
              cb(0)
            }
          }
        });
      }
    });
  })
  socket.on('initialize', function(schoolName,schoolAddress,adminName,school_reg_id,user_reg_id){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('INSERT INTO school_details SET ?', {schoolName:schoolName, school_reg_id:school_reg_id, school_address:schoolAddress}, function (err, results, fields) {
          if (!err) {
            connection.query('INSERT INTO users SET ?', {school_reg_id:school_reg_id, fname:adminName, user_reg_id:user_reg_id, position:'ADMIN', grade:'ADMIN', username:'ADMIN', password:'ADMIN', assignedSubject:''}, function (err, results, fields) {
              if (!err) {
                console.log(schoolName+" has been initialized");
                connection.release();
                socket.emit('loginSuccess','ADMIN',adminName,'ADMIN',user_reg_id,'ADMIN','ADMIN',school_reg_id,'');
              }else{
                console.log(err)
              }
            });
          }else{
            console.log(err)
          }
        });
      }
    });
  })
  socket.on('addSubject', function(subjectName,grade,school_reg_id,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('INSERT INTO subjects SET ?', {subjectName:subjectName, grade:grade, school_reg_id:school_reg_id}, function (err, results, fields) {
          if (!err) {
            connection.release();
            console.log('New subject has been added!');
            cb(200)
          }else{
            console.log(err)
          }
        });
      }
    });
  });
  socket.on('getSubjects', function(grade,school_reg_id){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM subjects WHERE grade=? AND school_reg_id=?',[grade,school_reg_id],function(error,result){
          if (!error) {
            if (result.length>0) {
              for (var i = 0; i < result.length; i++){
                var subjectName=result[i].subjectName;
                socket.emit('getSubjects',subjectName);
              }
            }
            connection.release();
          }
        });
      }
    });
  })
  socket.on('addLecturer', function(lecturerName,lecturerUsername,assignedSubject,grade,school_reg_id,user_reg_id,cb){
    console.log('what the he;ll')
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM users WHERE username=?',[lecturerUsername],function(error,result){
          if (!error) {
            if (result.length==0) {
              connection.query('INSERT INTO users SET ?', {school_reg_id:school_reg_id, fname:lecturerName, user_reg_id:user_reg_id, position:'LECTURER', grade:grade, username:lecturerUsername, password:'00000', assignedSubject:assignedSubject}, function (err, results, fields) {
                if (!err) {
                  connection.release();
                  console.log('New lecturer has been added!');
                  cb(200)
                }else{
                  console.log(err)
                }
              });
            }else{
              connection.release();
              cb(0)
            }
          }
        });
      }
    });
  });
  socket.on('register-student', function(school_reg_id,fname,username,password,grade,user_reg_id,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM users WHERE username=?',[username],function(error,result){
          if (!error) {
            if (result.length==0) {
              connection.query('INSERT INTO users SET ?', {school_reg_id:school_reg_id, fname:fname, user_reg_id:user_reg_id, position:'STUDENT', grade:grade, username:username, password:password, assignedSubject:''}, function (err, results, fields) {
                if (!err) {
                  connection.release();
                  console.log('New student has been added!');
                  socket.emit('loginSuccess','STUDENT',fname,grade,user_reg_id,username,password,school_reg_id,'');
                }else{
                  console.log(err);
                }
              });
            }else{
              connection.release();
              cb(0)
            }
          }
        });
      }
    });
  })
  socket.on('get-my-work', function(user){
    //filePath,workTopic,workNotes,user,level,uploadTime,subject,scheduled,condor
    getMyWork(user);
  })
  socket.on('add-question', function(workId,questionInput,answerA,answerB,answerC,correctAnswer,questionHint,school_reg_id,user,subject,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('INSERT INTO questions SET ?', {workId:workId, questionInput:questionInput, answerA:answerA, answerB:answerB, answerC:answerC, correctAnswer:correctAnswer, questionHint:questionHint, school_reg_id:school_reg_id, user:user, subject:subject}, function (err, results, fields) {
          if (!err) {
            connection.release();
            console.log('New question has been added!');
            getExercise(workId,socket);
            cb(200)
          }else{
            console.log(err)
          }
        });
      }
    });
  });
  socket.on('get-exercise', function(workId){
    console.log('The work id is '+workId)
    getExercise(workId,socket);
  });
  socket.on('get-my-subjects', function(grade,school_reg_id){
    console.log(grade+' ... whats delaying '+school_reg_id)
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM subjects WHERE grade=? AND school_reg_id=?',[grade,school_reg_id],function(error,result){
          if (!error) {
            if (result.length>0) {
              for (var i = 0; i < result.length; i++){
                var subjectName=result[i].subjectName;
                socket.emit('get-my-subjects',subjectName);
              }
            }
            connection.release();
          }
        });
      }
    });
  });
  socket.on('get-subject-work', function(level,subject,school_reg_id){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM work WHERE level=? AND subject=?',[level,subject],function(error,result){
          if (!error) {
            var len = result.length;
            if (result.length>0) {
              for (var i = 0; i < result.length; i++){
                var filePath=result[i].filePath;
                var workTopic=result[i].workTopic;
                var workNotes=result[i].workNotes;
                var user=result[i].user;
                var level=result[i].level;
                var uploadTime=result[i].uploadTime;
                var subject=result[i].subject;
                var scheduled=result[i].scheduled;
                var workId=result[i].id;
                var duration=result[i].duration;
                var maxReading=result[i].maxReading;
                socket.emit('get-subject-work', filePath,workTopic,workNotes,user,level,uploadTime,subject,scheduled,workId,duration,maxReading,len);
                len--;
              }
            }
            connection.release();
          }
        });
      }
    });
  })
  socket.on('get-specific-topic', function(workId){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM work WHERE id=?',[workId],function(error,result){
          if (!error) {
            var len = result.length;
            if (result.length>0) {
              for (var i = 0; i < result.length; i++){
                var filePath=result[i].filePath;
                var workTopic=result[i].workTopic;
                var workNotes=result[i].workNotes;
                var user=result[i].user;
                var level=result[i].level;
                var uploadTime=result[i].uploadTime;
                var subject=result[i].subject;
                var scheduled=result[i].scheduled;
                var workId=result[i].id;
                var duration=result[i].duration;
                var maxReading=result[i].maxReading;
                socket.emit('get-specific-topic', filePath,workTopic,workNotes,user,level,uploadTime,subject,scheduled,workId,duration,maxReading,len);
                len--;
              }
            }
            connection.release();
          }
        });
      }
    });
  })
  socket.on('get-questions', function(workId,user){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM exercise_results WHERE workId=? AND user=?',[workId,user],function(error,result){
          if (!error) {
            if (result.length>0) {
              var submitted = 'submitted';
            }else{
              var submitted = 'no';
            }
            connection.query('SELECT * FROM questions WHERE workId=?',[workId],function(error,result){
              if (!error) {
                if (result.length>0) {
                  var totalQuestions = result.length;
                  for (var i = 0; i < result.length; i++){
                    var questionInput=result[i].questionInput;
                    var answerA=result[i].answerA;
                    var answerB=result[i].answerB;
                    var answerC=result[i].answerC;
                    var correctAnswer=result[i].correctAnswer;
                    var questionHint=result[i].questionHint;
                    var school_reg_id=result[i].school_reg_id;
                    var questionId=result[i].id;
                    socket.emit('get-questions', questionId,questionInput,answerA,answerB,answerC,correctAnswer,questionHint,school_reg_id,submitted,totalQuestions)
                  }
                }
                connection.release();
              }
            });
          }
        });
      }
    });
  })
  socket.on('add-duration', function(duration,workId,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('UPDATE work SET ? WHERE ?', [{ duration: duration}, { id: workId }],function(err,result){
          connection.release();
          if (!err) {
            console.log("Updates where successful");
            cb('The exercise is now '+duration+' long')
          }
        });
      }
    });
  })
  socket.on('add-maxReading', function(maxReading,workId,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('UPDATE work SET ? WHERE ?', [{ maxReading: maxReading}, { id: workId }],function(err,result){
          connection.release();
          if (!err) {
            console.log("Updates where successful");
            cb('The maxmum allowed read time for this work is '+maxReading)
          }
        });
      }
    });
  })
  socket.on('submit-exercise-results', function(workId,percentagePassed,user,maxReading,timeSpent,expectedFinishTime,readTimes,cb){
    console.log('The user submitting is '+user)
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM exercise_results WHERE workId=? AND user=?',[workId,user],function(error,result){
          if (!error) {
            if (result.length == 0) {
              connection.query('INSERT INTO exercise_results SET ?', {workId:workId, percentagePassed:percentagePassed, user:user, maxReading:maxReading, timeSpent:timeSpent, expectedFinishTime:expectedFinishTime, readTimes:readTimes}, function (err, results, fields) {
                if (!err) {
                  connection.release();
                  console.log(user+ ' has submitted their work');
                  cb(200)
                }else{
                  console.log(err)
                }
              });   
            }
          }
        });
      }
    });
  });
  socket.on('add-time-table', function(grade,subject,time,day,school_reg_id,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM time_table WHERE grade=? AND subject=? AND day=? AND school_reg_id=?',[grade,subject,day,school_reg_id],function(error,result){
          if (!error) {
            if (result.length==0) {
              connection.query('INSERT INTO time_table SET ?', {grade:grade, subject:subject, time:time, day:day, school_reg_id:school_reg_id}, function (err, results, fields) {
                if (!err) {
                  connection.release();
                  cb(200)
                  getTimeTable(grade,school_reg_id,socket)
                }else{
                  console.log(err)
                }
              });
            }
          }
        });
      }
    });
  })
  socket.on('get-my-time-table', function(level,school_reg_id){
    getTimeTable(level,school_reg_id,socket)
  })
  socket.on('update-time-table', function(id,time,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('UPDATE time_table SET ? WHERE ?', [{ time: time}, { id:id}],function(err,result){
          connection.release();
          if (!err) {
            console.log("Updates where successful");
            cb(200)
          }else{
            console.log(err)
          }
        });
      }
    });
  })
  socket.on('update-profile', function(fname,username,password,user,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('UPDATE users SET ? WHERE ?', [{ fname:fname, username:username, password:password}, { user_reg_id:user}],function(err,result){
          connection.release();
          if (!err) {
            console.log("Updates where successful");
            cb(200)
          }else{
            console.log(err)
          }
        });
      }
    });
  })
  socket.on('add-assignment', function(assignmentQuestion,assignmentMarks,assignmentTopic,subject,grade,school_reg_id,user,assignmentId,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('INSERT INTO assignments SET ?', {assignmentQuestion:assignmentQuestion, assignmentMarks:assignmentMarks, assignmentTopic:assignmentTopic, subject:subject, grade:grade, school_reg_id:school_reg_id, dueTime:'', status:'pending', user:user, assignmentId:assignmentId}, function (err, results, fields) {
          if (!err) {
            connection.release();
            console.log('New assignment question has been added!');
            cb(200)
          }else{
            console.log(err)
          }
        });
      }
    });
  });
  socket.on('publish-assignment', function(dueTime,user,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('UPDATE assignments SET ? WHERE ?', [{ dueTime:dueTime, status:'in-progress'}, { user:user}],function(err,result){
          connection.release();
          if (!err) {
            console.log("Updates where successful");
            cb(200)
          }else{
            console.log(err)
          }
        });
      }
    });
  });
  socket.on('get-lec-ass', function(user){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM assignments WHERE user=?',[user],function(error,result){
          if (!error) {
            if (result.length>0) {
              var totalMarks = 0;
              var len = result.length;
              for (var i = 0; i < result.length; i++){
                var assignmentTopic=result[i].assignmentTopic;
                var assignmentId=result[i].assignmentId;
                var status=result[i].status;
                socket.emit('get-lec-ass', assignmentTopic,assignmentId,status)
              }
            }
            connection.release();
          }
        });
      }
    });
  });
  socket.on('get-sub-ass', function(subject,school_reg_id,grade){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM assignments WHERE subject=? AND school_reg_id=? AND grade=?',[subject,school_reg_id,grade],function(error,result){
          if (!error) {
            if (result.length>0) {
              var totalMarks = 0;
              var len = result.length;
              for (var i = 0; i < result.length; i++){
                var assignmentTopic=result[i].assignmentTopic;
                var assignmentId=result[i].assignmentId;
                var status=result[i].status;
                socket.emit('get-lec-ass', assignmentTopic,assignmentId,status)
              }
            }
            connection.release();
          }
        });
      }
    });
  });
  socket.on('get-this-ass', function(assignmentId){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM assignments WHERE assignmentId=?',[assignmentId],function(error,result){
          if (!error) {
            if (result.length>0) {
              var totalMarks = 0;
              var len = result.length;
              for (var i = 0; i < result.length; i++){
                var assignmentQuestion=result[i].assignmentQuestion;
                var assignmentId=result[i].assignmentId;
                var status=result[i].status;
                var assignmentMarks=result[i].assignmentMarks;
                totalMarks = totalMarks + parseFloat(assignmentMarks)
                socket.emit('get-this-ass', assignmentQuestion,assignmentId,assignmentMarks);
                if (len==1) {
                  socket.emit('show-total-marks', totalMarks);
                  getSubmitts(assignmentId,socket)
                }
                len--;
              }
            }
            connection.release();
          }
        });
      }
    });
  });
  socket.on('submit-ass-answers', function(assignmentQuestion,assignmentMarks,assignmentAnswer,assignmentId,user,fname){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM assignmentAnswers WHERE assignmentId=? AND user=?',[assignmentId,user],function(error,result){
          if (!error) {
            if (result.length==0) {
              connection.query('INSERT INTO assignmentAnswers SET ?', {assignmentQuestion:assignmentQuestion, assignmentMarks:assignmentMarks, assignmentAnswer:assignmentAnswer, user:user, correctAnswer:'', assignmentId:assignmentId, fname:fname, attainedMarks:''}, function (err, results, fields) {
                if (!err) {
                  connection.release();
                  console.log('New assignment answer has been added!');
                  socket.emit('submit-done',assignmentId)
                }else{
                  console.log(err)
                }
              }); 
            }
          }
        });
      }
    });
  });
  socket.on('get-submitter-ass', function(user,assignmentId){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM assignmentAnswers WHERE assignmentId=? AND user=?',[assignmentId,user],function(error,result){
          if (!error) {
            if (result.length>0) {
              for (var i = 0; i < result.length; i++){
                var user=result[i].user;
                var questionId=result[i].id;
                var fname=result[i].fname;
                var assignmentQuestion=result[i].assignmentQuestion;
                var assignmentAnswer=result[i].assignmentAnswer;
                var assignmentMarks=result[i].assignmentMarks;
                var attainedMarks=result[i].attainedMarks;
                var correctAnswer=result[i].correctAnswer;
                socket.emit('get-submitter-ass', user,fname,assignmentId,assignmentQuestion,assignmentAnswer,assignmentMarks,questionId,attainedMarks,correctAnswer);
              }
              connection.release();
            }
          }
        });
      }
    });
  });
  socket.on('submit-res-ass-answers', function(questionId,attainedMarks,correctAnswer){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('UPDATE assignmentAnswers SET ? WHERE ?', [{ attainedMarks:attainedMarks, correctAnswer:correctAnswer}, { id:questionId}],function(err,result){
          connection.release();
          if (!err) {
            console.log("you have marked question "+questionId);
            socket.emit('done-marking')
          }else{
            console.log(err)
          }
        });
      }
    });
  });
  socket.on('notify-users', function(user,school_reg_id,notifyInput,timeSend,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('INSERT INTO notice_board SET ?', {user:user, school_reg_id:school_reg_id, notifyInput:notifyInput, timeSend:timeSend}, function (err, results, fields) {
          if (!err) {
            connection.release();
            console.log('New notice has been added!');
            cb(200)
          }else{
            console.log(err)
          }
        }); 
      }
    });
  });
  socket.on('get-notice', function(school_reg_id){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM notice_board WHERE school_reg_id=?',[school_reg_id],function(error,result){
          if (!error) {
            if (result.length>0) {
              for (var i = 0; i < result.length; i++){
                var notifyInput=result[i].notifyInput;
                var timeSend=result[i].timeSend;
                var noticeId=result[i].id;
                socket.emit('get-notice', noticeId,notifyInput,timeSend)
              }
              connection.release();
            }
          }
        });
      }
    });
  });
  socket.on('get-my-students', function(school_reg_id,level){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM users WHERE school_reg_id=? AND grade=? AND position=?',[school_reg_id,level,'STUDENT'],function(error,result){
          if (!error) {
            if (result.length>0) {
              for (var i = 0; i < result.length; i++){
                var student=result[i].user_reg_id;
                var fname=result[i].fname;;
                socket.emit('get-my-students', student,fname)
              }
              connection.release();
            }
          }else{
            console.log(error)
          }
        });
      }
    });
  });
  socket.on('get-student-exercise-results', function(studentId){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM exercise_results WHERE user=?',[studentId],function(error,result){
          if (!error) {
            if (result.length>0) {
              var len = result.length;
              for (var i = 0; i < result.length; i++){
                var workId=result[i].workId;
                var percentagePassed=result[i].percentagePassed;
                var maxReading=result[i].maxReading;
                var readTimes=result[i].readTimes;
                var expectedFinishTime=result[i].expectedFinishTime;
                var timeSpent=result[i].timeSpent;
                socket.emit('get-student-exercise-results', workId,percentagePassed,maxReading,readTimes,expectedFinishTime,timeSpent,len);
              }
            }
            connection.release();
          }
        });
      }
    });
  });
  socket.on('send-chat-msg', function(text,fname,grade,school_reg_id,studentId){
    io.sockets.emit('send-chat-msg',text,fname,grade,school_reg_id,studentId)
  })
  socket.on('registerSchool', function(schoolName,schoolAddress,adminName,adminPhone,school_reg_id,reg_date,cb){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('INSERT INTO schools SET ?', {schoolName:schoolName, schoolAddress:schoolAddress, adminName:adminName, adminPhone:adminPhone, school_reg_id:school_reg_id, reg_date:reg_date}, function (err, results, fields) {
          if (!err) {
            console.log("New school has been added");
            connection.release();
            cb(200)
          }else{
            console.log(err)
          }
        });
      }
    });
  })
  socket.on('getSchools',function(){
    pool.getConnection(function(err,connection){  
      if (!err) {
        connection.query('SELECT * FROM schools',[],function(error,result){
          if (!error) {
            if (result.length>0) {
              for (var i = 0; i < result.length; i++){
                var schoolName=result[i].schoolName;
                var schoolAddress=result[i].schoolAddress;
                var adminName=result[i].adminName;
                var adminPhone=result[i].adminPhone;
                var school_reg_id=result[i].school_reg_id;
                socket.emit('getSchools',schoolName,schoolAddress,adminName,adminPhone,school_reg_id);
              }
            }
          }
          connection.release();
        });
      }
    });
  })
})
function getSubmitts(assignmentId,socket){
  pool.getConnection(function(err,connection){  
    if (!err) {
      connection.query('SELECT * FROM assignmentAnswers WHERE assignmentId=?',[assignmentId],function(error,result){
        if (!error) {
          if (result.length>0) {
            for (var i = 0; i < result.length; i++){
              var user=result[i].user;
              var fname=result[i].fname;
              var attainedMarks=result[i].attainedMarks;
              socket.emit('getSubmitts', user,fname,assignmentId,attainedMarks);
            }
            connection.release();
          }
        }
      });
    }
  });
}
function getTimeTable(level,school_reg_id,socket){
  pool.getConnection(function(err,connection){  
    if (!err) {
      connection.query('SELECT * FROM time_table WHERE grade=? AND school_reg_id=?',[level,school_reg_id],function(error,result){
        if (!error) {
          var len = result.length;
          if (result.length>0) {
            for (var i = 0; i < result.length; i++){
              var grade=result[i].grade;
              var subject=result[i].subject;
              var time=result[i].time;
              var day=result[i].day;
              var id=result[i].id;
              socket.emit('add-time-table', grade,subject,time,day,school_reg_id,id)
            }
          }
          connection.release();
        }
      });
    }
  });
}
function getExercise(workId,socket){
  pool.getConnection(function(err,connection){  
    if (!err) {
      connection.query('SELECT * FROM questions WHERE workId=?',[workId],function(error,result){
        if (!error) {
          if (result.length>0) {
            for (var i = 0; i < result.length; i++){
              var questionInput=result[i].questionInput;
              var answerA=result[i].answerA;
              var answerB=result[i].answerB;
              var answerC=result[i].answerC;
              var correctAnswer=result[i].correctAnswer;
              var questionHint=result[i].questionHint;
              var school_reg_id=result[i].school_reg_id;
              var questionId=result[i].id;
              socket.emit('get-exercise', questionId,questionInput,answerA,answerB,answerC,correctAnswer,questionHint,school_reg_id)
            }
          }
          connection.release();
        }
      });
    }
  });
}
