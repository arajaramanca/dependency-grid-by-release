Ext.define("TSApp", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box', layout:'hbox', padding: 10},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "TSApp"
    },

    // config: {
    //     defaultSettings: {
    //         showMoreColumns: false
    //     }
    // },

    // getSettingsFields: function() {
    //     var me = this;
    //     return [{
    //         name: 'showMoreColumns',
    //         itemId: 'showMoreColumns',
    //         xtype: 'rallycheckboxfield',
    //         boxLabelAlign: 'after',
    //         fieldLabel: '',
    //         margin:10,
    //         boxLabel: 'Show More Columns on Grid',
    //         checked: true
    //     }];
    // },
     
    launch: function() {
        var me = this;
        me._addSelector();
    },
      
    _addSelector: function() {
        var me = this;
        var selector_box = this.down('#selector_box');
        selector_box.removeAll();
        selector_box.add({
            xtype:'rallyreleasecombobox',
            fieldLabel: 'Release:',
            width:500,
            margin:10,
            showArrows : false,
            context : this.getContext(),
            growToLongestValue : true,
            defaultToCurrentTimebox : true,
            listeners: {
                scope: me,
                change: function(rcb) {
                    me.release = rcb;
                    me._queryAndDisplayGrid();
                }
            }
        });

        selector_box.add({
            name: 'showMoreColumns',
            itemId: 'showMoreColumns',
            xtype: 'rallycheckboxfield',
            boxLabelAlign: 'after',
            fieldLabel: '',
            margin:10,
            boxLabel: 'Show More Columns on Grid',
            checked: false,
            listeners: {
                scope: me,
                change: function() {
                    //me.release = rcb;
                    me._queryAndDisplayGrid();
                    //me.down('rallygrid').refresh();
                }
            }            
        });
        
        selector_box.add({
            xtype:'rallybutton',
            itemId:'export_button',
            text: 'Download CSV',
            margin:10,

            disabled: false,
            iconAlign: 'right',
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            },
            margin: '10',
            scope: this
        });

    },      

    _queryAndDisplayGrid: function(){
        var me = this;

        var model_name = 'HierarchicalRequirement',
            field_names = ['ObjectID','FormattedID','Name','Project','ScheduleState','Release','Iteration','StartDate','EndDate','ReleaseStartDate','ReleaseDate','Predecessors','Successors','Owner','Blocked','BlockedReason','Notes','Feature'],
            filters = [];
        var release_name = me.release.rawValue;

        filters = [{property:'Release.Name',value: release_name}];

        me._queryUserStoryAndDependencies(model_name, field_names,filters).then({
            scope: this,
            success: function(store) {
                this._displayGrid(store);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });

    },

    _queryUserStoryAndDependencies: function(model_name, field_names, filters){
        var deferred = Ext.create('Deft.Deferred');

        var me = this;

        me._loadAStoreWithAPromise(model_name, field_names, filters).then({
            success: function(records){
                    if (records){
                        var promises = [];
                        Ext.Array.each(records,function(story){
                            promises.push(function(){
                                return me._getCollection(story); 
                            });
                        },me);

                        Deft.Chain.sequence(promises).then({
                            success: function(results){
                                me.logger.log('_after getCollection >',results);
                                var us_deps = [];

                                for (var i = 0; records && i < records.length; i++) {
                                    for (var j = 0; j < results[i][0].length || j < results[i][1].length; j++) {
                                        var pre = j < results[i][0].length ? results[i][0][j]:null;
                                        var suc = j < results[i][1].length ? results[i][1][j]:null;
                                        console.log('pre,suc',pre,suc);
                                        
                                        //remove duplicates
                                        var storyRelOID = records[i] && records[i].get('Release') && records[i].get('Release').ObjectID ? records[i].get('Release').ObjectID : null;
                                        var preRelOID = pre && pre.get('Release') && pre.get('Release').ObjectID ? pre.get('Release').ObjectID : null;
                                        //var sucRelOID = suc && suc.get('Release') && suc.get('Release').ObjectID ? suc.get('Release').ObjectID : null;
                                        if(storyRelOID == preRelOID){
                                            pre = null;
                                        }
                                        // if(storyRelOID == sucRelOID){
                                        //     suc = null;
                                        // }
                                        if(pre != null || suc != null){


                                            if(pre != null){

                                                var us_dep = {
                                                    Predecessor: pre, 
                                                    Successor:records[i],
                                                };
                                                us_deps.push(us_dep);   
                                            }                                            
                                            if(suc != null){

                                                var us_dep = {
                                                    Predecessor:records[i],
                                                    Successor: suc,
                                                };   
                                                us_deps.push(us_dep);
                                            }
                                        }
                                    }
                                }

                                // create custom store 
                                var store = Ext.create('Rally.data.custom.Store', {
                                    data: us_deps,
                                    scope: me
                                });
                                deferred.resolve(store);                        
                            },
                            scope: me
                        });
                    } else {
                        deferred.reject('Problem loading: ');
                    }
                },
                failure: function(error_message){

                    deferred.reject(error_message);

                },
                scope: me
            }).always(function() {
                me.setLoading(false);
            });
            return deferred.promise;

    },

    _getCollection: function(record){
        me = this;
        var deferred = Ext.create('Deft.Deferred');

        var promises = [];

        promises.push(function(){
            return ; 
        });

        promises.push(function(){
            return ; 
        });                        
        
        Deft.Promise.all([me._getPredecessors(record), me._getSuccessors(record)],me).then({
            success: function(results){
                deferred.resolve(results);                      
            },
            scope: me
        });


        return deferred;
    },

    _getSuccessors: function(record){
        me = this;
        var deferred = Ext.create('Deft.Deferred');
        if(record.get('Successors').Count > 0){
            record.getCollection('Successors').load({
                fetch: ['ObjectID','FormattedID','Name','Project','ScheduleState','Release','Iteration','StartDate','EndDate','ReleaseStartDate','ReleaseDate', 'Successors','Owner','Blocked','BlockedReason','Notes'],
                scope: me,
                callback: function(records, operation, success) {
                    deferred.resolve(records);
                }
            });
        }else{
            deferred.resolve([]);                    
        }
        return deferred;
    },

    _getPredecessors: function(record){
        me = this;
        var deferred = Ext.create('Deft.Deferred');
        if(record.get('Predecessors').Count > 0){
            record.getCollection('Predecessors').load({
                fetch: ['ObjectID','FormattedID','Name','Project','ScheduleState','Release','Iteration','StartDate','EndDate','ReleaseStartDate','ReleaseDate', 'Successors','Owner','Blocked','BlockedReason','Notes'],
                scope: me,
                callback: function(records, operation, success) {
                    deferred.resolve(records);
                }
            });
        }else{
            deferred.resolve([]);                    
        }
        return deferred;
    },


    _loadAStoreWithAPromise: function(model_name, model_fields, model_filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: model_filters
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(store){
        var me = this;
        me.down('#display_box').removeAll();

        var grid = {
            xtype: 'rallygrid',
            store: store,
            showRowActionsColumn: false,
            columnCfgs:me._getColumns()
            // ,
            // style: {
            //      border: '1px solid black'
            // }
        };

        me.down('#display_box').add(grid);

    },

    _getColumns: function(){

    var me = this;
    var pre_columns = [];

    pre_columns.push(
        { text: 'Give User<br>Story ID',  flex: 1, dataIndex: 'Predecessor',                            renderer:function(Predecessor,metaData){     return  Predecessor ? Predecessor.get('FormattedID'):'...'; }},
        { text: 'User Story Name',  flex: 3, dataIndex: 'Predecessor', renderer:function(Predecessor){     return  Predecessor ? Predecessor.get('Name'):'...'; }},
        { text: 'Project Name',  flex: 3, dataIndex: 'Predecessor', renderer:function(Predecessor){     return Predecessor  && Predecessor.get('Project') ? Predecessor.get('Project').Name:'...'; }},
        { text: 'Schedule<br>State',  flex: 1, dataIndex: 'Predecessor', renderer:function(Predecessor){     return  Predecessor ? Predecessor.get('ScheduleState'):'...'; }},
        {text: 'Release Name',flex: 2, dataIndex: 'Predecessor', renderer:function(Predecessor){    return  Predecessor && Predecessor.get('Release') ? Predecessor.get('Release').Name:'...';}},
        {text: 'Blocked', flex: 1,dataIndex: 'Predecessor',renderer:function(Predecessor){    return  Predecessor && Predecessor.get('Blocked') ? 'Yes' : 'No';}},
        {
            text: 'In<br>Release?', 
            dataIndex: 'Predecessor',
            flex: 1 ,
            renderer:function(Predecessor){    
                return  Predecessor && Predecessor.get('Release') && (Predecessor.get('Release').Name == me.release.rawValue) ? "Yes":"No";
            }          
        },
        {text: 'Iteration<br>End Date', flex: 1,dataIndex: 'Predecessor',renderer:function(Predecessor){    return Predecessor && Predecessor.get('Iteration') ? Ext.util.Format.date(Predecessor.get('Iteration').EndDate) : '...';}}
                    
    );    

    if(me.down('#showMoreColumns').value){
        pre_columns.push(
            {text: 'Feature ID', flex: 1,dataIndex: 'Predecessor',renderer:function(Predecessor){    return Predecessor && Predecessor.get('Feature') ? Predecessor.get('Feature').FormattedID:'...';}},
            {text: 'Feature Name',flex: 2, dataIndex: 'Predecessor',renderer:function(Predecessor){    return Predecessor && Predecessor.get('Feature') ? Predecessor.get('Feature').Name:'...';}},
            {text: 'Release Start Date', flex: 1,dataIndex: 'Predecessor',renderer:function(Predecessor){    return Predecessor && Predecessor.get('Release') ? Ext.util.Format.date(Predecessor.get('Release').ReleaseStartDate):'...';}},
            {text: 'Release End Date',flex: 1, dataIndex: 'Predecessor',renderer:function(Predecessor){    return Predecessor && Predecessor.get('Release') ? Ext.util.Format.date(Predecessor.get('Release').ReleaseDate):'...';}},
            {text: 'Iteration Name', flex: 2,dataIndex: 'Predecessor',renderer:function(Predecessor){    return Predecessor && Predecessor.get('Iteration') ? Predecessor.get('Iteration').Name:'...';}},
            {text: 'Iteration Start Date',flex: 1, dataIndex: 'Predecessor',renderer:function(Predecessor){    return Predecessor && Predecessor.get('Iteration') ? Ext.util.Format.date(Predecessor.get('Iteration').StartDate): '...';}},
            {text: 'Owner',flex: 1, dataIndex: 'Predecessor',renderer:function(Predecessor){    return Predecessor && Predecessor.get('Owner') ? Predecessor.get('Owner').Name : '...';}},
            {text: 'Blocked Reason',flex: 2,dataIndex: 'Predecessor',renderer:function(Predecessor){    return  Predecessor ? Predecessor.get('BlockedReason'):'...';}},
            {text: 'Notes', flex: 3, dataIndex: 'Predecessor', renderer:function(Predecessor){    return  Predecessor ? Predecessor.get('Notes'):'...';}}        
        );        
    }


    var succ_columns = [];

    succ_columns.push({
                            text: 'Get User<br>Story ID', 
                            dataIndex: 'Successor',
                            flex: 1, 
                            renderer:function(Successor){
                                return Successor ? Successor.get('FormattedID'):'...';
                            }
                        },
                        {
                            text: 'User Story Name', 
                            dataIndex: 'Successor',flex: 1, 
                            flex: 3,
                            renderer:function(Successor){
                                return Successor ? Successor.get('Name') :'...';
                            }
                        },
                        {
                            text: 'Project Name', 
                            dataIndex: 'Successor',flex: 1, 
                            flex: 3,
                            renderer:function(Successor){
                                return Successor && Successor.get('Project') ? Successor.get('Project').Name : '...';
                            }
                        },
                        {
                            text: 'Schedule<br>State', 
                            dataIndex: 'Successor',flex: 1, 
                            flex: 1,                    
                            renderer:function(Successor){
                                return Successor ? Successor.get('ScheduleState'):'...';
                            }
                        },
                        {
                            text: 'Release Name', 
                            dataIndex: 'Successor',
                            flex: 2,
                            renderer:function(Successor){
                                return Successor && Successor.get('Release') ? Successor.get('Release').Name : '...';
                            }
                        },

                        {
                            text: 'In<br>Release?', 
                            dataIndex: 'Successor',
                            flex: 1 ,
                            renderer:function(Successor){    
                                return  Successor && Successor.get('Release') && (Successor.get('Release').Name == me.release.rawValue) ? "Yes":"No";
                            }          
                        },
                        {
                            text: 'Iteration<br>Start Date', 
                            dataIndex: 'Successor',
                            flex: 1,                    
                            renderer:function(Successor){
                                return Successor && Successor.get('Iteration') ? Ext.util.Format.date(Successor.get('Iteration').StartDate) : '...';
                            }
                        }                        
                        );

    if(me.down('#showMoreColumns').value){
            succ_columns.push(
                        {
                            text: 'Blocked', 
                            dataIndex: 'Successor',
                            flex: 1,                    
                            renderer:function(Successor){
                                return Successor && Successor.get('Blocked')? 'Yes':'No';
                            }
                        },                
                        {text: 'Feature ID', flex: 1,dataIndex: 'Successor',renderer:function(Successor){    return Successor && Successor.get('Feature') ? Successor.get('Feature').FormattedID:'...';}},
                        {text: 'Feature Name', dataIndex: 'Successor',renderer:function(Successor){    return Successor && Successor.get('Feature') ? Successor.get('Feature').Name:'...';}},
                        {
                            text: 'Release Start Date', 
                            dataIndex: 'Successor',
                            flex: 2,                    
                            renderer:function(Successor){
                                return Successor && Successor.get('Release') ? Ext.util.Format.date(Successor.get('Release').ReleaseStartDate) : '...';
                            }
                        },
                        {
                            text: 'Release End Date', 
                            dataIndex: 'Successor',
                            flex: 1,                    
                            renderer:function(Successor){
                                return Successor && Successor.get('Release') ?  Ext.util.Format.date(Successor.get('Release').ReleaseDate) : '...';
                            }
                        },
                        {
                            text: 'Iteration Name', 
                            dataIndex: 'Successor',
                            flex: 1,                    
                            renderer:function(Successor){
                                return Successor && Successor.get('Iteration') ? Successor.get('Iteration').Name : '...';
                            }
                        },
                        {
                            text: 'Iteration End Date', 
                            dataIndex: 'Successor',
                            flex: 1,                    
                            renderer:function(Successor){
                                return Successor && Successor.get('Iteration') ? Ext.util.Format.date(Successor.get('Iteration').EndDate) : '...';
                            }
                        },
                        {
                            text: 'Owner', 
                            dataIndex: 'Successor',
                            flex: 1,                    
                            renderer:function(Successor){
                                return Successor && Successor.get('Owner') ? Successor.get('Owner').Name : '...'
                            }
                        },
                        {
                            text: 'Blocked Reason', 
                            dataIndex: 'Successor',
                            flex: 2,                    
                            renderer:function(Successor){
                                return Successor ? Successor.get('BlockedReason'):'...';
                            }
                        },
                        {
                            text: 'Notes', 
                            dataIndex: 'Successor',
                            flex: 3,                    
                            renderer:function(Successor){
                                return Successor ? Successor.get('Notes'):'...';
                            }
                        }
                        );
    }

    return [
                {
                    text: 'Give (Predecessors)',
                    menuDisabled: false,
                    columns: pre_columns,
                    draggable: false, 
                    hideable: false,
                    sortable: false,
                    border:5,
                    style: {
                        backgroundColor: '#cccccc'
                    },
                    flex:1              
                },
                // {
                //     text: 'Stories',
                //     columns: story_columns,
                //     draggable: false, 
                //     hideable: false,
                //     sortable: false,
                //     border:5,
                //     style: {
                //         backgroundColor: '#cccccc'
                //     }     

                // },                
                {
                    text: 'Get (Successors)',
                    columns: succ_columns,
                    draggable: false, 
                    hideable: false,
                    sortable: false,
                    border:5,
                    style: {
                        backgroundColor: '#cccccc'
                    },
                    flex:1
                }
                ];

    },

    _export: function(){
        var grid = this.down('rallygrid');
        var me = this;

        if ( !grid ) { return; }
        
        this.logger.log('_export',grid);

        var filename = Ext.String.format('dependency-snapsot.csv');

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities._getCSVFromCustomBackedGrid(grid) } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }
    
});
