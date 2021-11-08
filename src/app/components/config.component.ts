/*!
 * Copyright florianmatthias o.G. 2021 - All rights reserved
 */

import { AfterViewInit, Component, ElementRef, EventEmitter, isDevMode, Renderer2, ViewChild } from '@angular/core';
import { RendererService } from '../services/renderer.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { IMAGES_SERVICE_IMAGES_MINIMUM, ImagesService, UIImage } from '../services/images.service';
import { MessageService } from '../services/message.service';

enum CanvasSize {
    sm,
    md,
    lg
}

const CanvasPrices = [
    [ '54,90', '39,90' ],
    [ '74,90', '59,90' ],
    [ '84,90', '69,90' ]
]

interface PrevUIImg {
    id: string;
    dataURL: string;
}

@Component({
    selector: 'app-config',
    templateUrl: './config.component.html'
})
export class ConfigComponent implements AfterViewInit {

    public tooltip: boolean = false;
    public imagesLength: EventEmitter<number> = new EventEmitter<number>();

    @ViewChild('konvacanvas', { static: true }) private _konvaCanvas: ElementRef;

    private _inputElem: HTMLInputElement;
    private _totalCounter = 0;
    private _canvasSize: CanvasSize = CanvasSize.sm;
    private _images: PrevUIImg[] = [];

    public constructor ( private _renderSvc: RendererService,
                         private _imagesService: ImagesService,
                         private _renderer: Renderer2,
                         private _msgDialog: MessageService )
    {
    }

    public ngAfterViewInit () : void {
        this._renderSvc.init( this._konvaCanvas.nativeElement );
        setTimeout( () => this.addImage(), 100);
    }

    public get canvasSize () : CanvasSize {
        return this._canvasSize;
    }

    public get canvasPriceOriginal () : string {
        return CanvasPrices[this._canvasSize][0];
    }

    public get canvasPriceFinal () : string {
        return CanvasPrices[this._canvasSize][1];
    }

    public set canvasSize ( value : CanvasSize ) {
        this._canvasSize = value;
        this._renderSvc.setSize( this._konvaCanvas.nativeElement.offsetWidth, this._konvaCanvas.nativeElement.offsetHeight );
    }

    public get sizeClass (): string {
        switch ( this.canvasSize ) {
            case CanvasSize.sm: return 'small';
            case CanvasSize.md: return 'medium';
            case CanvasSize.lg: return 'large';
        }
        return '';
    }

    public get uploadBtnVisible (): boolean {
        return this._totalCounter < this.maxImages;
    }

    public get tooltipVisible (): boolean {
        return window.innerWidth < 1200 && this.tooltip;
    }

    public set tooltipVisible ( value: boolean ) {
        if ( window.innerWidth < 1200 ) {
            this.tooltip = !value;
        }
    }

    public get images (): Array<PrevUIImg> {
        if ( this._images.length != this._imagesService.images.length ) {
            // Make a copy of UI images, so when shuffling the previews do not shuffle as well
            this._images = [];
            this._imagesService.images.forEach( i => this._images.push( { dataURL: i.dataURL, id: i.id } ) );
            this.imagesLength.emit(this._images.length);
        }
        return this._images;
    }

    public get maxImages (): number {
        return this._imagesService.maxImages;
    }

    public get working (): boolean {
        return this._imagesService.working;
    }

    public get progress (): number {
        return !!this.working ? ( this._imagesService.processingCurrent / this._imagesService.processingTotal ) * 100 : 0;
    }

    public shuffleImages () {
        this._renderSvc.shuffle();
    }

    public addImage () {

        // Note: does not work well if element is created within the view itself;
        // Generates awkward behaviour if selecting same files twice;
        // No clean element reset method found, so create it dynamically
        this._inputElem = this._renderer.createElement( 'input' );

        // Safari under iOS requires element to be within DOM
        this._renderer.appendChild( this._konvaCanvas.nativeElement, this._inputElem );

        this._inputElem.type = 'file';
        this._inputElem.multiple = true;
        this._inputElem.accept = 'image/*';
        this._inputElem.style.display = 'none';
        this._inputElem.addEventListener( 'change', () => this._addImage() );

        // Trigger file selection dialog
        this._inputElem.click();
    }

    public removeImage ( image: string ) {

        this._imagesService.removeImage( image );
        this._totalCounter -= 1;

        // Shuffle again
        this.shuffleImages();
    }

    private _addImage () {

        let fLen = this._inputElem.files.length;
        if (this._totalCounter + this._inputElem.files.length > this.maxImages ) {
            fLen = this.maxImages - this._totalCounter;
        }
        this._totalCounter += fLen;

        this._imagesService.addFiles( this._inputElem.files, fLen ).pipe(
            catchError( err => {

                // Something substantial happened => What TODO???
                if ( isDevMode() ) {
                    console.warn( 'Error adding files', err );
                }

                // Keep the pipe results intact
                const res: Array<boolean> = new Array<boolean>( this._inputElem.files.length );
                res.fill( false );

                return of( res );
            } ),
            finalize( () => {
                // When all is done => remove the this._inputElem from the dom again
                this._renderer.removeChild( this._konvaCanvas.nativeElement, this._inputElem );
            } )
        ).subscribe( () => {

            if (
                this._imagesService.images.length >= IMAGES_SERVICE_IMAGES_MINIMUM &&
                !this._imagesService.working
            ) {
                // Trigger update
                this._renderSvc.shuffle();
            }

        } );

    }

}
