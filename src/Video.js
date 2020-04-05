import React, { Component } from 'react';
import io from 'socket.io-client'
import IconButton from '@material-ui/core/IconButton';

import VideocamIcon from '@material-ui/icons/Videocam';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import MicIcon from '@material-ui/icons/Mic';
import MicOffIcon from '@material-ui/icons/MicOff';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import CallEndIcon from '@material-ui/icons/CallEnd';

import { Container, Row, Col} from 'reactstrap';
import 'bootstrap/dist/css/bootstrap.css';
import "./Video.css"

const server_url = "http://localhost:3000" //"http://localhost:3000"

var connections = {}
const peerConnectionConfig = {
	'iceServers': [
		{ 'urls': 'stun:stun.services.mozilla.com' },
		{ 'urls': 'stun:stun.l.google.com:19302' },
	]
}
var socket = null
var socketId = null

var elms = 0

class Video extends Component {
	constructor(props) {
		super(props)

		this.localVideoref = React.createRef()

		this.path = window.location.href

		this.videoAvailable = false
		this.audioAvailable = false
		this.screenAvailable = false

		this.video = false
		this.audio = false
		this.screen = false

		this.state = {
			video: false,
			audio: false,
			screen: false,
		}

		this.getMedia()
	}

	async getMedia() {
		await navigator.mediaDevices.getUserMedia({ video: true })
			.then((stream) => {
				this.videoAvailable = true
				this.video = true
			})
			.catch((e) => {
				this.videoAvailable = false
			})

		await navigator.mediaDevices.getUserMedia({ audio: true })
			.then((stream) => {
				this.audioAvailable = true
				this.audio = true
			})
			.catch((e) => {
				this.audioAvailable = false
			})

		this.setState({
			video: this.video,
			audio: this.audio,
			screen: this.screen
		}, () => {
			this.getUserMedia()
		})

		if (navigator.mediaDevices.getDisplayMedia) {
			this.screenAvailable = true
		} else {
			this.screenAvailable = false
		}
	}


	getUserMedia = () => {
		if ((this.state.video && this.videoAvailable) || (this.state.audio && this.audioAvailable)) {
			if (socket !== null) {
				socket.disconnect()
			}
			navigator.mediaDevices.getUserMedia({ video: this.state.video, audio: this.state.audio })
				.then(this.getUserMediaSuccess)
				.then((stream) => {
					var main = document.getElementById('main')
					var videos = main.querySelectorAll("video")
					for(let a = 0; a < videos.length; ++a){
						if(videos[a].id !== "my-video"){
							videos[a].parentNode.removeChild(videos[a])
						}
					}

					this.connectToSocketServer()
				})
				.catch((e) => console.log(e))
		} else {
			try {
				let tracks = this.localVideoref.current.srcObject.getTracks()
				tracks.forEach(track => track.stop())
			} catch (e) {
				
			}
		}
	}

	getUserMediaSuccess = (stream) => {
		window.localStream = stream
		this.localVideoref.current.srcObject = stream

		// stream.getVideoTracks()[0].onended = () => {
		//   console.log("video / audio false")
		//   this.setState({ 
		//     video: false,
		//     audio: false,
		//     screen: this.state.screen
		//   }, () => {
		//     let tracks = this.localVideoref.current.srcObject.getTracks()
		//     tracks.forEach(track => track.stop())
		//   })
		// };
	}


	getDislayMedia = () => {
		if (this.state.screen) {
			if (socket !== null) {
				socket.disconnect()
			}

			if (navigator.mediaDevices.getDisplayMedia) {
				navigator.mediaDevices.getDisplayMedia({ video: true }) // this.state.screen
					.then(this.getDislayMediaSuccess)
					.then((stream) => {
						var main = document.getElementById('main')
						var videos = main.querySelectorAll("video")
						for(let a = 0; a < videos.length; ++a){
							if(videos[a].id !== "my-video"){
								videos[a].parentNode.removeChild(videos[a])
							}
						}

						this.connectToSocketServer()
					})
					.catch((e) => console.log(e))
			}
		}
	}

	getDislayMediaSuccess = (stream) => {
		window.localStream = stream
		this.localVideoref.current.srcObject = stream

		stream.getVideoTracks()[0].onended = () => {
			this.setState({
				video: this.state.video,
				audio: this.state.audio,
				screen: false,
			}, () => {
				try {
					let tracks = this.localVideoref.current.srcObject.getTracks()
					tracks.forEach(track => track.stop())
				} catch (e) {
					console.log(e)
				}

				this.getUserMedia()
			})
		};
	}


	gotMessageFromServer = (fromId, message) => {
		//Parse the incoming signal
		var signal = JSON.parse(message)

		//Make sure it's not coming from yourself
		if (fromId !== socketId) {
			if (signal.sdp) {
				connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
					if (signal.sdp.type === 'offer') {
						connections[fromId].createAnswer().then((description) => {
							connections[fromId].setLocalDescription(description).then(() => {
								socket.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }));
							}).catch(e => console.log(e));
						}).catch(e => console.log(e));
					}
				}).catch(e => console.log(e));
			}

			if (signal.ice) {
				connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
			}
		}
	}

	connectToSocketServer = () => {
		socket = io.connect(server_url, { secure: true });
		socket.on('signal', this.gotMessageFromServer);

		socket.on('connect', () => {

			socket.emit('join-call', this.path);

			socketId = socket.id;

			socket.on('user-left', function (id) {
				var video = document.querySelector(`[data-socket="${id}"]`);
				if (video !== null) {
					elms--
					video.parentNode.removeChild(video);

					var main = document.getElementById('main')
					var videos = main.querySelectorAll("video")

					var width = ""
					if(elms === 1 || elms === 2){
						width = "100%"
					} else if(elms === 3 || elms === 4){
						width = "40%"
					} else {
						width = String(100/elms) + "%"
					}

					var height = String(100/elms) + "%"

					for(let a = 0; a < videos.length; ++a){
						videos[a].style.minWidth = "30%"
						videos[a].style.minHeight = "30%"
						videos[a].style.setProperty("width", width)
						videos[a].style.setProperty("height", height)
					}
				}
			});

			socket.on('user-joined', function (id, clients) {
				console.log("joined")
				connections = {} // TODO eh, una merda, ma non so come fare
				clients.forEach(function (socketListId) {
					if (connections[socketListId] === undefined) {
						connections[socketListId] = new RTCPeerConnection(peerConnectionConfig);
						//Wait for their ice candidate       
						connections[socketListId].onicecandidate = function (event) {
							if (event.candidate != null) {
								socket.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }));
							}
						}

						//Wait for their video stream
						connections[socketListId].onaddstream = function (event) {

							// TODO mute button, full screen button

							elms = clients.length
							var main = document.getElementById('main')
							var videos = main.querySelectorAll("video")

							var width = ""
							if(elms === 1 || elms === 2){
								width = "100%"
							} else if(elms === 3 || elms === 4){
								width = "40%"
							} else {
								width = String(100/elms) + "%"
							}

							var height = String(100/elms) + "%"

							for(let a = 0; a < videos.length; ++a){
								videos[a].style.minWidth = "30%"
								videos[a].style.minHeight = "30%"
								videos[a].style.setProperty("width", width)
								videos[a].style.setProperty("height", height)
							}
							
							var video = document.createElement('video')
							video.style.minWidth = "30%"
							video.style.minHeight = "30%"
							video.style.setProperty("width", width)
							video.style.setProperty("height", height)
							video.style.margin = "10px"

							video.setAttribute('data-socket', socketListId);
							video.srcObject = event.stream
							video.autoplay = true;
							// video.muted       = true;
							video.playsinline = true;

							main.appendChild(video)
						}

						//Add the local video stream
						if (window.localStream !== undefined) {
							connections[socketListId].addStream(window.localStream);
						}
					}
				});

				//Create an offer to connect with your local description
				connections[id].createOffer().then((description) => {
					connections[id].setLocalDescription(description)
						.then(() => {
							socket.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }));
						})
						.catch(e => console.log(e));
				});
			});
		})
	}


	handleVideo = () => {
		this.setState({
			video: !this.state.video,
			audio: this.state.audio,
			screen: this.state.screen
		}, () => {
			this.getUserMedia()
		})
	}

	handleAudio = () => {
		this.setState({
			video: this.state.video,
			audio: !this.state.audio,
			screen: this.state.screen
		}, () => {
			this.getUserMedia()
		})
	}

	handleScreen = () => {
		this.setState({
			video: this.state.video,
			audio: this.state.audio,
			screen: !this.state.screen
		}, () => {
			this.getDislayMedia()
		})
	}

	handleEndCall = () => {
		try {
			let tracks = this.localVideoref.current.srcObject.getTracks()
			tracks.forEach(track => track.stop())
		} catch (e) {

		}

		window.location.href = "/"
	}

	render() {
		return (
			<div>
				<div className="container">
					
					<Row id="main" className="flex-container">
						<video id="my-video" ref={this.localVideoref} autoPlay></video>
					</Row>

					<div className="btn-down">
						<IconButton style={{ color: "#424242" }} onClick={this.handleVideo}>
							{(this.state.video === false) ? <VideocamIcon /> : <VideocamOffIcon />}
						</IconButton>

						<IconButton style={{ color: "#f44336" }} onClick={this.handleEndCall}>
							<CallEndIcon />
						</IconButton>

						<IconButton style={{ color: "#424242" }} onClick={this.handleAudio}>
							{this.state.audio === false ? <MicIcon /> : <MicOffIcon />}
						</IconButton>

						<IconButton style={{ color: "#424242" }} onClick={this.handleScreen}>
							{this.state.screen === false ? <ScreenShareIcon /> : <StopScreenShareIcon />}
						</IconButton>
					</div>
				</div>

			</div>
		)
	}
}

export default Video;