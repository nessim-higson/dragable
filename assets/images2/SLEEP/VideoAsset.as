package {
	import org.casalib.display.CasaSprite;
	import org.casalib.util.StageReference;

	import com.zero.display.ui.SimpleVideo;
	
	public class VideoAsset extends CasaSprite {
		
		public function VideoAsset() {	
			StageReference.setStage(this.stage);
					
			// adds a link button
			var _vid:SimpleVideo = new SimpleVideo('test.mp4');
			addChild(_vid);
		
		}
	}
}