(function(require, define){
   define(['jquery', 'APIconnector', 'iframes', 'settings', 'uiEventsHelper', 'eexcessMethods'], function($, api, iframes, settings, uiEventsHelper, eexcessMethods){

      api.init(eexcessMethods.originHeader);
      function mergeWithCache(response){
         var cache = JSON.parse(sessionStorage.getItem("curResults"));
         if(response.hasOwnProperty("documentBadge") && response.documentBadge.hasOwnProperty("length")){
            var res = response.documentBadge;
            for(i=0; i<res.length; i++){
               for(j=0; j<cache.result.length; j++){
                  if(cache.result[j].documentBadge.id == res[i].id){
                     // replace a Badge containing the details
                     cache.result[j].documentBadge = res[i];
                  }
               }
            }
            sessionStorage.setItem("curResults", JSON.stringify(cache));
         } else {
            throw new Error("Invalid response format");
         }
      }

      return {
         /**
          * Extracts text marked by the user and sends it to the recommender.
          * The UI is updated accordingly.
          */
         getTextAndRecommend: function() {
            var query = this.getSelectedText();
            if(query !== ""){
               var profile = $.extend(eexcessMethods.compileUserProfile(), {contextKeywords: [{
                  text: query,
                  weight: 1.0
               }]});
               iframes.sendMsgAll({event: 'eexcess.queryTriggered', data: profile});
               this.sendQuery(profile); // send the request
               sessionStorage["eexcess.lastSearchQuery"] = query;
            }
            uiEventsHelper.queryTriggered(query);

            // log event
            if(eexcessMethods.loggingEnabled()){
               api.sendLog("moduleOpened", eexcessMethods.getModuleOpenedLogObj("SearchResultList"));
            }
         },

         /**
          * Sends a profil (including a search term) to the recommender. 
          */
         sendQuery : function(profile) {
           api.query(profile, function(res) {
               if (res.status === 'success') {
                   if(res.data.result.length == 0){
                     iframes.sendMsg({event: "eexcess.error", data: "noResults"}, ["resultList"]);
                   }
                   var res = {
                      profile: profile, 
                      result: res.data.result, 
                      queryID: res.data.queryID
                   };
                   $('iframe#dashboard').load(function(){
                      if(eexcessMethods.loggingEnabled() && localStorage["userID"] != undefined){
                         userID = localStorage["userID"];
                      } else {
                         userID = "";
                      }

                      // initializing vis dashboard
                      iframes.sendMsgAll({event: 'eexcess.newDashboardSettings', settings: {
                          //selectedChart: 'geochart',
                          hideCollections: true,
                          showLinkImageButton: true,
                          showLinkItemButton: true,
                          origin: { clientType: 'EEXCESS - Wordpress Plug-in', clientVersion: settings.version, userID: userID }
                      }});
                      // when the dashboard is currently displayed, then...
                      if( $("#dashboard").parent().attr("id") == "TB_ajaxContent"){
                         iframes.sendMsg({event: 'eexcess.newResults', data: res}, ["dashboard"]);
                      };
                   });
                   sessionStorage.setItem("curResults", JSON.stringify(res));

                   // extract documentBadges
                   var badges = [];
                   for (i=0; i<res.result.length; i++){
                      if(res.result[i].hasOwnProperty("documentBadge")){
                         badges.push(res.result[i].documentBadge);
                      }
                   }
                   // fetch details
                   eexcessMethods.fetchDetails(badges, function(response){
                      if(response.status == 'success'){
                         mergeWithCache(response.data);
                      } else {
                      }
                   });

                   // inform other frames that new results have arrived
                   iframes.sendMsg({event: 'eexcess.newResults', data: res}, ["resultList"]);
                   tinyMCE.activeEditor.buttons["Vis_Dashboard"].enable();
               } else {
                   iframes.sendMsg({event: 'eexcess.error', data: res.data}, ["resultList"]);
               }
           });
         },

         /**
          * This functions is called when a keyup-event occurs either in the visal-editor
          * or in the text-editor. It checks whether a certain keystroke combo was used (e.g.
          * ctrl+e). If so, it returns true, otherwise false.
          * EEXCESS.keyboardBindungs.getRecommendations are used.
          *
          * @param keyPressed: the object that ist passed to an keylistener-eventhandler.
          */
         assessKeystroke : function(keyPressed){
            if (keyPressed.keyCode == settings.keyboardBindungs.getRecommendations
             && keyPressed.ctrlKey){
                return true;
            }
            return false;

         },
         
         /**
          * Returns text from the Wordpress texteditor selcted by the user 
          */
         getSelectedText : function(){
            var text = "";
            // Visual Editor
            if(text == "" && tinyMCE.activeEditor && tinyMCE.activeEditor.isHidden() == false) {
               text = tinyMCE.activeEditor.selection.getContent( {format : "text"} );
            } else { // Casual TextEditor
               try {
                  var ta = $j('.wp-editor-area').get(0);
                     text = ta.value.substring(ta.selectionStart, ta.selectionEnd);
               } catch (e) {
                  console.log('Exception during get selection text');
               }
            }
            return text;
         }
      };

   });
}(EEXCESS.require, EEXCESS.define));
