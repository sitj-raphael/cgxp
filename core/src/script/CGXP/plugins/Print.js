/**
 * Copyright (c) 2011 Camptocamp
 *
 * CGXP is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * CGXP is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with CGXP.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @requires plugins/Tool.js
 * @include GeoExt/widgets/Action.js
 * @include GeoExt/data/PrintProvider.js
 * @include GeoExt/plugins/PrintProviderField.js
 * @include GeoExt.ux/SimplePrint.js
 * @include OpenLayers/Feature/Vector.js
 * @include OpenLayers/Geometry/Polygon.js
 * @include OpenLayers/Layer/Vector.js
 * @include OpenLayers/Renderer/SVG.js
 * @include OpenLayers/Renderer/VML.js
 * @include OpenLayers/Control/TransformFeature.js
 */

/** api: (define)
 *  module = cgxp.plugins
 *  class = Print
 */

Ext.namespace("cgxp.plugins");

/** api: example
 *  Sample code showing how to add a Print plugin to a
 *  `gxp.Viewer`:
 *
 *  .. code-block:: javascript
 *
 *      new gxp.Viewer({
 *          ...
 *          tools: [{
 *              ptype: 'cgxp_print',
 *              legendPanelId: "legendPanel",
 *              featureProvider: "featureGrid",
 *              outputTarget: "left-panel",
 *              printURL: "${request.route_url('printproxy', path='')}",
 *              mapserverURL: "${request.route_url('mapserverproxy', path='')}",
 *              options: {
 *                  labelAlign: 'top',
 *                  defaults: {
 *                      anchor: '100%'
 *                  },
 *                  autoFit: true
 *              }
 *          }]
 *          ...
 *      });
 */

/** api: constructor
 *  .. class:: Print(config)
 *
 */   
cgxp.plugins.Print = Ext.extend(gxp.plugins.Tool, {
    
    /** api: ptype = cgxp_print */
    ptype: "cgxp_print",

    /** api: config[legendPanelId]
     *  ``String``
     *  Id of the legendPanel tool.
     */
    legendPanelId: null,

    /** api: config[featureProvider]
     *  ``String``
     *  Id of the featureProvider tool.
     */
    featureProvider: null,

    printPanel: null,

    mapserverURL: null,

    /** api: config[options]
     *  ``String``
     *  panel config options.
     */
    options: null,

    /** api: config[timeout]
     * ``Integer``
     * The timeout delay for the print in milliseconds. Default to 2 minutes.
     */
    timeout: 120000,

    /** api: config[encodeLayer]
     * ``Object``
     * Additional attribute used on encode layer.
     * Default to { useNativeAngle: true }
     */
    encodeLayer: {
        useNativeAngle: true
    },

    printTitle: "Printing",
    titlefieldText: "Title",
    titlefieldvalueText: "Map title",
    commentfieldText: "Comment",
    commentfieldvalueText: "Comment on the map",
    includelegendText: "Include legend",
    dpifieldText: "Resolution",
    scalefieldText: "Scale",
    rotationfieldText: "Rotation",
    printbuttonText: "Print",
    exportpngbuttonText: "Export in PNG",
    waitingText: "Printing...",
    downloadText: 'Download',
    readyText: 'Your PDF is ready.',
    failureTitle: "Printing Failure",
    failureText: "An error occured while printing. Please check the parameters.",
    layoutText: "Layout",

    /** private: method[addOutput]
     *  :arg config: ``Object``
     */
    addOutput: function(config) {
        
        this.includeLegend = !!(this.legendPanelId);

        // create a print provider
        var printProvider = new GeoExt.data.PrintProvider({
            url: this.printURL,
            timeout: this.timeout,
            baseParams: {
                url: this.printURL
            },
            listeners: {
                beforedownload: function(pp, url) {
                    if (Ext.isIE) {
                        var win = new Ext.Window({
                            width: 200,
                            cls: 'pdf-window',
                            items: [
                                {
                                    html: this.readyText
                                },
                                {
                                    xtype: 'button',
                                    text: this.downloadText,
                                    handler: function() {
                                        window.open(url);
                                        win.hide();
                                    }
                                }
                            ]
                        });
                        win.show();
                    }
                    else if (Ext.isOpera) {
                        // Make sure that Opera don't replace the content tab
                        // with the pdf
                        window.open(url);
                    } else {
                        // This avoids popup blockers for all other browsers
                        window.location.href = url;
                    }
                    return false;
                }
            }
        });
        printProvider.on('beforeencodelayer', function(printProvider, layer) {
            if (layer instanceof OpenLayers.Layer.Vector) {
                var features = [];
                // reviews the layer features to remove the wrong ones
                // (because they make the print service crash)
                for (var i = 0, n = layer.features.length; i < n; i++) {
                    var f = layer.features[i];
                    var b = f.geometry.bounds;

                    // removes 0-length lines
                    if (f.geometry instanceof OpenLayers.Geometry.LineString &&
                        (!b || (b.getWidth() == 0 && b.getHeight() == 0))) {
                        continue;
                    }

                    // removes flat polygons
                    if ((f.geometry instanceof OpenLayers.Geometry.Polygon ||
                        f.geometry instanceof OpenLayers.Geometry.MultiPolygon) &&
                        f.geometry.getArea() == 0) {
                        continue;
                    }

                    features.push(f);
                }
                if (features.length == 0) {
                    return false;
                }
                layer.features = features;
            }
            return true;
        });
        printProvider.on('encodelayer', function(printProvider, layer, encodedLayer) {
            var apply = false;
            if (layer.mapserverLayers) {
                if (Ext.isArray(layer.mapserverLayers)) {
                    encodedLayer.layers = layer.mapserverLayers;
                } else {
                    encodedLayer.layers = layer.mapserverLayers.split(',');
                }
                encodedLayer.customParams = layer.mapserverParams;
                encodedLayer.format = 'image/png';
                apply = true;
            }
            if (apply) {
                encodedLayer.baseURL =  this.mapserverURL;
                encodedLayer.type =  'WMS';
                delete encodedLayer.dimensions;
                delete encodedLayer.formatSuffix;
                delete encodedLayer.layer;
                delete encodedLayer.matrixSet;
                delete encodedLayer.maxExtent;
                delete encodedLayer.params;
                delete encodedLayer.requestEncoding;
                delete encodedLayer.resolutions;
                delete encodedLayer.style;
                delete encodedLayer.tileOrigin;
                delete encodedLayer.tileSize;
                delete encodedLayer.version;
                delete encodedLayer.zoomOffset;
                encodedLayer.singleTile = true;
            }
            if (encodedLayer.customParams) {
                encodedLayer.baseURL = OpenLayers.Util.urlAppend(encodedLayer.baseURL,
                        OpenLayers.Util.getParameterString(encodedLayer.customParams));
                delete encodedLayer.customParams;
            }
            if (encodedLayer) {
                Ext.apply(encodedLayer, this.encodeLayer);
            }
        }.createDelegate(this));

        // handle query result table
        printProvider.on('beforeprint', function(printProvider, map, pages, options) {
            options.legend = this.includeLegend ? 
                             this.target.tools[this.legendPanelId].legendPanel : null;

            // need to define the table object even for page0 as java expects it
            pages[0].customParams = {col0: '', table:{data:[{col0: ''}], columns:['col0']}};
            pages[0].customParams.showMap = true;
            pages[0].customParams.showScale = true;
            pages[0].customParams.showAttr = false;
            pages[0].customParams.showNorth = true;
            pages[0].customParams.showScalevalue = true;
            pages[0].customParams.showMapframe = true;
            pages[0].customParams.showMapframeQueryresult = false;
            // new blank page, if query results
            if (this.featureProvider) {

                // clear existing result pages
                while (pages.length > 1) {
                    pages.pop();
                }

                var printExport = this.target.tools[this.featureProvider].printExport();
                if (printExport instanceof Array) {
                    var pageCount = 1;
                    for (dataset in printExport) {
                        if (printExport.hasOwnProperty(dataset)) {
                            // TODO, implement paging in case of too many result to display on only one page
                            if (printExport[dataset].table.data.length > 0 && printExport[dataset].table.data[0].col0 != '') {
                                var page = new GeoExt.data.PrintPage({
                                    printProvider: printProvider
                                });
                                page.center = pages[0].center.clone();
                                page.customParams = printExport[dataset];
                                page.customParams.showMap = false;
                                page.customParams.showScale = false;
                                page.customParams.showAttr = true;
                                page.customParams.showNorth = false;
                                page.customParams.showScalevalue = false;
                                page.customParams.showMapframe = false;
                                page.customParams.showMapframeQueryresult = true;
                                pages[pageCount] = page;
                            }
                            pageCount++;
                        }
                    }
                }
            }
        }.createDelegate(this));

        printProvider.on('loadcapabilities', function(printProvider, capabilities) {
            // if png is supported, add a button into the print panel
            if (Ext.pluck(capabilities.outputFormats, 'name').indexOf('png') != -1) {
                if (this.printPanel) {
                    this.printPanel.addButton({
                        text: this.exportpngbuttonText
                    }, function() {
                        printProvider.customParams.outputFormat = 'png';
                        this.printExtent.print(this.printOptions);
                        delete printProvider.customParams.outputFormat;
                    }, this.printPanel);
                }
            }
        }.createDelegate(this));

        // create the print panel
        options = Ext.apply({
            mapPanel: this.target.mapPanel,
            map: this.target.mapPanel.map,
            layer: new OpenLayers.Layer.Vector(null, {
                displayInLayerSwitcher: false,
                styleMap: new OpenLayers.StyleMap({
                    "temporary": new OpenLayers.Style({
                        fillColor: "#ffffff",
                        fillOpacity: 1,
                        strokeColor: "#66cccc",
                        strokeOpacity: 1,
                        strokeWidth: 2,
                        pointRadius: 4,
                        cursor: "${role}"
                    }),
                    "rotate": new OpenLayers.Style({
                        externalGraphic: OpenLayers.Util.getImagesLocation() +
                            "print-rotate.png",
                        fillOpacity: 1.0,
                        graphicXOffset: 8,
                        graphicYOffset: 8,
                        graphicWidth: 20,
                        graphicHeight: 20,
                        cursor: "pointer",
                        display: "${display}",
                        rotation: "${rotation}"
                    }, {
                        context: {
                            display: function(f) {
                                return f.attributes.role == "se-rotate" ? "" : "none";
                            },
                            rotation: function(f) {
                                return printPanel.printPage.rotation;
                            }
                        }
                    })
                })
            }),
            printExtentOptions: {
                transformFeatureOptions: {
                    rotationHandleSymbolizer: "rotate"
                }
            },
            bodyStyle: 'padding: 10px',
            printProvider: printProvider,
            title: this.printTitle,
            items: [{
                xtype: 'textfield',
                name: 'title',
                fieldLabel: this.titlefieldText,
                emptyText: this.titlefieldvalueText,
                plugins: new GeoExt.plugins.PrintProviderField(),
                autoCreate: {tag: "input", type: "text", size: "45", maxLength: "45"}
            }, {
                xtype: 'textarea',
                name: 'comment',
                fieldLabel: this.commentfieldText,
                emptyText: this.commentfieldvalueText,
                plugins: new GeoExt.plugins.PrintProviderField(),
                autoCreate: {tag: "textarea", maxLength: "100"}
            }, {
                xtype: 'checkbox',
                name: 'legend',
                fieldLabel: this.includelegendText,
                checked: this.includeLegend,
                // deactivate the checkbox if no legend panel is available
                hidden: !this.includeLegend, 
                handler: function(cb, checked) {
                    this.includeLegend = checked;
                },
                scope: this
            }],
            comboOptions: {
                editable: false
            },
            dpiText: this.dpifieldText,
            scaleText: this.scalefieldText,
            rotationText: this.rotationfieldText,
            printText: this.printbuttonText,
            layoutText: this.layoutText,
            creatingPdfText: this.waitingText
        }, this.options);
        printPanel = new GeoExt.ux.SimplePrint(options);

        printProvider.on('printexception', function(printProvider, response) {
            printPanel.busyMask.hide();
            Ext.Msg.alert(this.failureTitle, this.failureText);
        });

        // the print panel auto-shows the print extent when
        // the capabilities are loaded. We work around that
        // by listening to loadcapabilities and hiding the
        // extent when the capabilities are loaded.
        printProvider.on({
            'loadcapabilities': function() {
                printPanel.hideExtent();
            }
        });
        printProvider.loadCapabilities();
      
        this.printPanel = cgxp.plugins.Print.superclass.addOutput.call(this, printPanel);

        Ext.getCmp(this.outputTarget).on('expand', function() {
            printPanel.printExtent.fitPage();
        }, this);

        return this.printPanel;
    }

});

Ext.preg(cgxp.plugins.Print.prototype.ptype, cgxp.plugins.Print);

