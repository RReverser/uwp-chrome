declare namespace JSX {
	interface Element extends Windows.Data.Xml.Dom.XmlElement {}

	interface ActionProps {
		content: string;
		arguments: string;
		activationType?: 'foreground' | 'background' | 'protocol' | 'system';
		imageUri?: string;
		'hint-inputId'?: string;
	}

	interface ActionsProps {}

	interface AudioProps {
		src?: string;
		loop?: boolean;
		silent?: boolean;
	}

	interface BindingProps {
		template: 'ToastGeneric';
		lang?: string;
		addImageQuery?: string;
		baseUri?: string;
	}

	interface ImageProps {
		src: string;
		placement?:  'inline' | 'appLogoOverride';
		alt?: string;
		addImageQuery?: boolean;
		'hint-crop'?: 'none' | 'circle';
	}

	interface InputProps {
		id: string;
		type: 'text' | 'selection';
		title?: string;
		placeHolderContent?: string;
		defaultInput?: string;
	}

	interface SelectionProps {
		id: string;
		content: string;
	}

	interface TextProps {
		lang?: string;
	}

	interface ToastProps {
		launch?: string;
		duration?: 'short' | 'long';
		activationType?: 'foreground' | 'background' | 'protocol' | 'system';
		scenario?: 'default' | 'alarm' | 'reminder' | 'incomingCall';
	}

	interface VisualProps {
		lang?: string;
		baseUri?: string;
		addImageQuery?: boolean;
	}

	interface IntrinsicElements {
		action: ActionProps;
		actions: ActionsProps;
		audio: AudioProps;
		binding: BindingProps;
		image: ImageProps;
		input: InputProps;
		selection: SelectionProps;
		text: TextProps;
		toast: ToastProps;
		visual: VisualProps;
	}
}
