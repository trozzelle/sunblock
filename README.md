### Sunblock - Bluesky auto-blocker

This is a script to help manage blocking spam and abusive acounts. Currently it does two things: 1) it reads through your followers and blocks anyone who is following greater than the number 
you set in the .env file, 2) it allows you to subscribe to other user's block lists by providing their handle in .env.

It syncs with your user repo, so if you make changes to your block list manually and they won't be overwritten.

There is a scheduler script included that will allow you to run the blocking and sync at an interval that you set.

#### Code is under heavy construction. 
