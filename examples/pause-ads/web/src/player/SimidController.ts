import * as simid from '@broadpeak-tv/simid-controller'

// Mirrors SIMID traffic to the SmartLib controller API (analytics) and to an optional observer.
export default class SimidController extends simid.SimidController {

  public simidControllerApi?: any /* GenericSimidControllerApi */
  public onTraffic?: (direction: 'received' | 'sent', raw: string) => void

  protected receiveMessage(event: MessageEvent): void {
    this.simidControllerApi?.onMessageReceived(event.data)
    this.onTraffic?.('received', typeof event.data === 'string' ? event.data : JSON.stringify(event.data))
    super.receiveMessage(event)
  }

  protected postMessage(message: simid.Message): void {
    const raw = JSON.stringify(message)
    this.simidControllerApi?.onMessageSent(raw)
    this.onTraffic?.('sent', raw)
    super.postMessage(message)
  }
}
